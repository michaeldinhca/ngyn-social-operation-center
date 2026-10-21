/** Sample exports are named so nobody mistakes them for real reports. */
export const csvFilename = (kind: 'series' | 'accounts', range: string, stamp: string) => `sample-${kind}-${range}-${stamp}.csv`
