export interface Stage {
  key: 'transplantDate' | 'sowingDate' | 'emergenceDate' | 'stemElongationDate' | 'headingDate' | 'maturityDate';
  label: string;
  apiName: 'transplant' | 'sowing' | 'emergence' | 'stem_elongation' | 'heading' | 'maturity';
}

export const RICE_STAGES: Stage[] = [
  { key: 'transplantDate', label: '移植期', apiName: 'transplant' },
  { key: 'headingDate', label: '出穂期', apiName: 'heading' },
  { key: 'maturityDate', label: '成熟期', apiName: 'maturity' },
];

export const WHEAT_STAGES: Stage[] = [
  { key: 'sowingDate', label: '播種期', apiName: 'sowing' },
  { key: 'emergenceDate', label: '出芽期', apiName: 'emergence' },
  { key: 'stemElongationDate', label: '茎立期', apiName: 'stem_elongation' },
  { key: 'headingDate', label: '出穂期', apiName: 'heading' },
  { key: 'maturityDate', label: '成熟期', apiName: 'maturity' },
];

export const getStages = (system: 'rice' | 'wheat'): Stage[] => {
  return system === 'rice' ? RICE_STAGES : WHEAT_STAGES;
};
