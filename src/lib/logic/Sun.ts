
export class SUN {
  time: Date;
  d: number;
  latitude: number;
  longitude: number;
  readonly rad: number = Math.PI / 180.0;
  readonly deg: number = 180.0 / Math.PI;

  constructor(datetimeobj: Date = new Date(2000, 0, 1), latitude: number = 35.0, longitude: number = 135.0) {
    this.time = datetimeobj;
    const year = this.time.getFullYear();
    const month = this.time.getMonth(); // 0-indexed in JS
    const day = this.time.getDate();
    // seconds from midnight / 86400
    const midnight = new Date(year, month, day, 0, 0, 0);
    this.d = (this.time.getTime() - midnight.getTime()) / 1000.0 / 86400.0;
    this.latitude = latitude;
    this.longitude = longitude;
  }

  settime(datetimeobj: Date) {
    this.time = datetimeobj;
    const year = this.time.getFullYear();
    const month = this.time.getMonth();
    const day = this.time.getDate();
    const midnight = new Date(year, month, day, 0, 0, 0);
    this.d = (this.time.getTime() - midnight.getTime()) / 1000.0 / 86400.0;
  }

  setlat(latitude: number) {
    this.latitude = latitude;
  }

  setlon(longitude: number) {
    this.longitude = longitude;
  }

  adjusttime(): Date {
    const year = this.time.getFullYear();
    const month = this.time.getMonth();
    const day = this.time.getDate();
    const midnight = new Date(year, month, day, 0, 0, 0);
    // d is 0-1 fraction of day
    this.time = new Date(midnight.getTime() + this.d * 86400.0 * 1000.0);
    return this.time;
  }

  julius_year(): number {
    let year = this.time.getFullYear();
    let month = this.time.getMonth() + 1; // 1-indexed for the formula
    const day = this.time.getDate();
    const d = this.d;

    if (month === 1 || month === 2) {
      year = year - 1;
      month = month + 12;
    }
    const kp = 365.0 * (year - 2000) + 30.0 * month + day - 33.875 + Math.floor(3 * (month + 1) / 5) + Math.floor((year - 2000) / 4.0);
    const dt = 65.0 + (year - 2000);
    const k = kp + d + dt / 86400.0;
    const yjul = k / 365.25;
    return yjul;
  }

  distance(): number {
    const rad = this.rad;
    const t = this.julius_year();
    let q = (0.007256 - 0.0000002 * t) * Math.sin((267.54 + 359.991 * t) * rad);
    q += 0.000091 * Math.sin((265.1 + 719.98 * t) * rad);
    q += 0.000030 * Math.sin((90.0) * rad);
    q += 0.000013 * Math.sin((27.8 + 4452.67 * t) * rad);
    q += 0.000007 * Math.sin((254.0 + 450.40 * t) * rad);
    q += 0.000007 * Math.sin((156.0 + 329.60 * t) * rad);
    const r = Math.pow(10, q);
    return r;
  }

  visalradius(): number {
    return 0.266994 / this.distance();
  }

  lambda_s(): number {
    const rad = this.rad;
    const t = this.julius_year();
    let l_s = 280.4603 + 360.00769 * t;
    l_s += (1.9146 - 0.00005 * t) * Math.sin((357.538 + 359.991 * t) * rad);
    l_s += 0.0200 * Math.sin((355.05 + 719.981 * t) * rad);
    l_s += 0.0048 * Math.sin((234.95 + 19.341 * t) * rad);
    l_s += 0.0020 * Math.sin((247.1 + 329.64 * t) * rad);
    l_s += 0.0018 * Math.sin((297.8 + 4452.67 * t) * rad);
    l_s += 0.0018 * Math.sin((251.3 + 0.20 * t) * rad);
    l_s += 0.0015 * Math.sin((343.2 + 450.37 * t) * rad);
    l_s += 0.0013 * Math.sin((81.4 + 225.18 * t) * rad);
    l_s += 0.0008 * Math.sin((132.5 + 659.29 * t) * rad);
    l_s += 0.0007 * Math.sin((153.3 + 90.38 * t) * rad);
    l_s += 0.0007 * Math.sin((206.8 + 30.35 * t) * rad);
    l_s += 0.0006 * Math.sin((29.8 + 337.18 * t) * rad);
    l_s += 0.0005 * Math.sin((207.4 + 1.50 * t) * rad);
    l_s += 0.0005 * Math.sin((291.2 + 22.81 * t) * rad);
    l_s += 0.0004 * Math.sin((234.9 + 315.56 * t) * rad);
    l_s += 0.0004 * Math.sin((157.3 + 299.30 * t) * rad);
    l_s += 0.0004 * Math.sin((21.1 + 720.02 * t) * rad);
    l_s += 0.0003 * Math.sin((352.5 + 1079.97 * t) * rad);
    l_s += 0.0003 * Math.sin((329.7 + 44.43 * t) * rad);
    l_s = l_s % 360.0;
    return l_s;
  }

  epsilon(): number {
    const t = this.julius_year();
    const eps = 23.439291 - 0.000130042 * t;
    return eps;
  }

  alpha(): number {
    const rad = this.rad;
    const deg = this.deg;
    const eps = this.epsilon() * rad;
    const l_s = this.lambda_s() * rad;
    let alp = Math.atan(Math.tan(l_s) * Math.cos(eps)) * deg;
    if (l_s < 180.0 * rad) {
      alp = alp % 180;
    } else {
      if (alp > 0.0) {
        alp = alp + 180.0;
      } else {
        alp = alp + 360.0;
      }
    }
    return alp;
  }

  delta(): number {
    const rad = this.rad;
    const deg = this.deg;
    const eps = this.epsilon() * rad;
    const l_s = this.lambda_s() * rad;
    const dlt = Math.asin(Math.sin(l_s) * Math.sin(eps)) * deg;
    return dlt;
  }

  theta(): number {
    const lon = this.longitude;
    const t = this.julius_year();
    const d = this.d;
    let the = 325.4606 + 360.007700536 * t + 0.00000003879 * t * t + 360.0 * d + lon;
    the = the % 360.0;
    return the;
  }

  hour_angle(): number {
    return this.theta() - this.alpha();
  }

  elevation(): number {
    const deg = this.deg;
    const rad = this.rad;
    const dlt = this.delta() * rad;
    const t = this.hour_angle() * rad;
    const lat = this.latitude * rad;
    const sinh = Math.sin(dlt) * Math.sin(lat) + Math.cos(dlt) * Math.cos(lat) * Math.cos(t);
    const h = Math.asin(sinh) * deg;
    return h;
  }

  azimus(): number {
    const deg = this.deg;
    const rad = this.rad;
    const dlt = this.delta() * rad;
    const t = this.hour_angle() * rad;
    const lat = this.latitude * rad;
    const denominator = Math.sin(dlt) * Math.cos(lat) - Math.cos(dlt) * Math.sin(lat) * Math.cos(t);
    let azi = 0.0;
    if (denominator > 0.0) {
      const tanA = -Math.cos(dlt) * Math.sin(t) / denominator;
      azi = Math.atan(tanA) * deg;
    } else if (denominator < 0.0) {
      const tanA = -Math.cos(dlt) * Math.sin(t) / denominator;
      azi = Math.atan(tanA) * deg + 180.0;
    } else {
      if (t > 0.0) {
        azi = -90.0;
      } else if (t < 0.0) {
        azi = 90.0;
      } else {
        azi = NaN;
      }
    }
    azi = azi % 360.0;
    return azi;
  }

  parallax(): number {
    const rad = this.rad;
    const h = this.elevation();
    const r = this.distance();
    const R = 0.0167 / Math.tan((h + 8.6 / (h + 4.4)) * rad);
    const p = 0.0024428 / r;
    const para = R - p;
    return para;
  }

  hour_angle_at_(h: number): number {
    const deg = this.deg;
    const rad = this.rad;
    const dlt = this.delta() * rad;
    const lat = this.latitude * rad;
    const costh = (Math.sin(h * rad) - Math.sin(dlt) * Math.sin(lat)) / (Math.cos(dlt) * Math.cos(lat));
    const th = Math.acos(costh) * deg;
    return th;
  }

  at_geometoric(h: number, isforenoon: boolean = true): number {
    const sig = isforenoon ? -1 : 1;
    let d = 0.5;
    this.d = d;
    let diff = 0.0;
    for (let i = 0; i < 10; i++) {
        const thc = this.hour_angle();
        const th = sig * Math.abs(this.hour_angle_at_(h));
        diff = (th - thc) % 360.0 / 360.0;
        if (Math.abs(diff) > 0.5) {
            diff = diff - 1.0;
        }
        d = (d + diff) % 1.0;
        if (Math.abs(diff) < 0.00005) {
            break;
        }
        this.d = d;
    }
    this.adjusttime();
    return d;
  }

  at_sunrise(): number {
    const s = this.visalradius();
    const p = 0.0024428 / this.distance();
    const r = 0.585556;
    const h = -s - r + p;
    return this.at_geometoric(h, true);
  }

  at_sunset(): number {
    const s = this.visalradius();
    const p = 0.0024428 / this.distance();
    const r = 0.585556;
    const h = -s - r + p;
    return this.at_geometoric(h, false);
  }
}

// Helper function to calculate day length
export function calculateDayLength(date: Date, lat: number, lon: number): number {
  const sun = new SUN(date, lat, lon);
  const sunrise = sun.at_sunrise();
  const sunset = sun.at_sunset();
  // sunrise/sunset are fraction of day (0-1). 
  // Need to handle day wrap if sunset < sunrise? Usually not for this logic unless polar.
  return (sunset - sunrise) * 24.0;
}
