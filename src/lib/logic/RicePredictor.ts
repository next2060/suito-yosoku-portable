import { VarietyParams, WeatherData, PredictionResult } from './types';
import { calculateDayLength } from './Sun';
import { addDays, format, parseISO, isSameDay, isAfter, isBefore } from 'date-fns';

// --- DVR Calculation ---
function DVR(gv: number, lc: number, th: number, a: number, b: number, dvs_star: number, T: number, L: number, current_dvs: number): number {
    // 1. Temperature factor
    const temp_factor = 1 / (1 + Math.exp(-a * (T - th)));

    // 2. Day length factor
    let photo_factor = 1.0;
    if (current_dvs < dvs_star) {
        // Stage where photosensitivity is not yet active
        photo_factor = 1.0;
    } else {
        // Photosensitive stage
        // If L > lc, L-lc is positive? Python says min(L - lc, 0)
        // Python: effective_L = min(L - lc, 0) -> If L > lc, effective_L = 0 
        // Wait, if L > lc (Long day), effective_L = 0 -> photo_factor = 1 - 1 = 0?
        // Python code: photo_factor = 1 - np.exp(b * effective_L)
        // If effective_L is 0, exp(0)=1, factor=0. Growth stops?
        // If L < lc (Short day), effective_L is negative. exp(negative) < 1. factor > 0.
        // So Short Day promotes growth?
        const effective_L = Math.min(L - lc, 0);
        photo_factor = 1 - Math.exp(b * effective_L);
    }

    return (1 / gv) * photo_factor * temp_factor;
}

// --- Main Prediction Function ---
export function runPrediction(
    lat: number,
    lon: number,
    variety: VarietyParams,
    weatherData: WeatherData[], // Assumed to be sorted by date and filled (Act + Avg)
    startDateStr: string,
    startStage: 'transplant' | 'heading' = 'transplant'
): PredictionResult {

    try {
        const startDate = parseISO(startDateStr);
        if (isNaN(startDate.getTime())) {
            return { heading_date: null, maturity_date: null, error: `Invalid date: ${startDateStr}` };
        }

        const { gv, th, lc, a, b, tmax, Adj, dvs_star = 0.0 } = variety;
        let DVS = variety.DVS;

        let headingDate: Date | null = null;
        let maturityDate: Date | null = null;

        // Find start index in weather data
        const startIndex = weatherData.findIndex(w => w.date === startDateStr);
        if (startIndex === -1) {
             // If start date is not found, maybe it's too early or too late?
             // Or maybe we should look for the closest?
             // For now, assume exact match required or handled by caller.
             return { heading_date: null, maturity_date: null, error: "StartDate not found in weather data" };
        }

        // Case 1: From Transplant
        if (startStage === 'transplant') {
            let tsum = 0.0;
            let useDVS = true;

            // Loop through weather data starting from transplant date
            for (let i = startIndex; i < weatherData.length; i++) {
                const w = weatherData[i];
                const currentDate = parseISO(w.date);
                const T = w.temp;
                
                // Calculate Day Length (L) for this date/lat/lon
                // NOTE: Calculating on the fly. 
                 const L = calculateDayLength(currentDate, lat, lon);

                if (useDVS) {
                    // Prediction until Heading (DVS method)
                    const dvr_val = DVR(gv, lc, th, a, b, dvs_star, T, L, DVS);
                    DVS += dvr_val;

                    if (DVS > 1.0) {
                        useDVS = false;
                        // Add Adjustment Days
                        headingDate = addDays(currentDate, Adj);
                    }
                } else {
                    // Prediction until Maturity (Accumulated Temp)
                    tsum += T;
                    
                    if (tsum > tmax) {
                        maturityDate = currentDate;
                        break;
                    }
                }
            }
            if (!headingDate) console.warn(`[Predictor] Loop finished without reaching Heading. Final DVS: ${DVS.toFixed(3)}, Data Length: ${weatherData.length - startIndex} days checked.`);
            if (headingDate && !maturityDate) console.warn(`[Predictor] Loop finished without reaching Maturity. Final Tsum: ${tsum.toFixed(1)} / ${tmax}`);

        } 
        // Case 2: From Heading (Actual)
        else if (startStage === 'heading') {
            headingDate = startDate;
            let tsum = 0.0;
            
            // Start loop from NEXT day
            // Python: "for i, Ti in enumerate... if current_date <= start_date: continue"
            
            for (let i = startIndex + 1; i < weatherData.length; i++) {
                const w = weatherData[i];
                const currentDate = parseISO(w.date);
                const T = w.temp;
                
                tsum += T;
                if (tsum > tmax) {
                    maturityDate = currentDate;
                    break;
                }
            }
        }

        // --- Calculate MET26 (High Temp Damage Risk) ---
        let met26: number | null = null;
        if (headingDate) {
            // MET26 period: Heading + 1 day to Heading + 20 days (19 days duration? Python says +1 to +19?)
            // Python: met26_start_date = heading + 1 day
            //         met26_end_date = start + 19 days
            //         slice(start, end) includes end? Xarray slice is inclusive usually.
            //         So 20 days window.
            
            const mStart = addDays(headingDate, 1);
            const mEnd = addDays(mStart, 19);
            
            let sumExcess = 0;
            let count = 0;
            let hasData = false;

            // Find window in weather data
            // We can scan or define range.
            // Since weatherData is sorted, we can find range.
            
            for (const w of weatherData) {
                const d = parseISO(w.date);
                if ((isSameDay(d, mStart) || isAfter(d, mStart)) && (isSameDay(d, mEnd) || isBefore(d, mEnd))) {
                     if (w.temp > 26) {
                         sumExcess += (w.temp - 26);
                     }
                     count++;
                     hasData = true;
                }
            }
            
            if (hasData) {
                met26 = sumExcess / 20.0; // Python: sum_of_excess / 20.0
            }
        }

        return {
            heading_date: headingDate ? format(headingDate, 'yyyy-MM-dd') : null,
            maturity_date: maturityDate ? format(maturityDate, 'yyyy-MM-dd') : null,
            met26
        };

    } catch (e: any) {
        return { heading_date: null, maturity_date: null, error: e.message };
    }
}
