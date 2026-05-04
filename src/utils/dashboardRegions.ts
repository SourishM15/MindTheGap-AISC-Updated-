import { MAJOR_METRO_AREAS } from '../data/states';

export const METRO_TO_STATE: Record<string, string> = {
  'Atlanta': 'Georgia',
  'Austin': 'Texas',
  'Boston': 'Massachusetts',
  'Chicago': 'Illinois',
  'Dallas': 'Texas',
  'Denver': 'Colorado',
  'Houston': 'Texas',
  'Jacksonville': 'Florida',
  'Los Angeles': 'California',
  'Miami': 'Florida',
  'Minneapolis': 'Minnesota',
  'New York': 'New York',
  'Philadelphia': 'Pennsylvania',
  'Phoenix': 'Arizona',
  'Portland': 'Oregon',
  'San Antonio': 'Texas',
  'San Diego': 'California',
  'San Jose': 'California',
  'Seattle': 'Washington',
  'Washington': 'District of Columbia',
};

export const METRO_REGION_ALIASES: Record<string, string> = {
  'New York Metro': 'New York',
  'Washington Metro': 'Washington',
};

export const getCanonicalRegion = (selectedRegion: string) => {
  return METRO_REGION_ALIASES[selectedRegion] ?? selectedRegion;
};

export const isMetroRegion = (selectedRegion: string, canonicalRegion = getCanonicalRegion(selectedRegion)) => {
  const isForcedMetro = selectedRegion.endsWith(' Metro');
  return isForcedMetro || (MAJOR_METRO_AREAS.includes(canonicalRegion) && !(['Washington', 'New York'].includes(canonicalRegion)));
};

export const getStateForRegion = (selectedRegion: string, canonicalRegion = getCanonicalRegion(selectedRegion)) => {
  return isMetroRegion(selectedRegion, canonicalRegion) ? (METRO_TO_STATE[canonicalRegion] ?? canonicalRegion) : canonicalRegion;
};
