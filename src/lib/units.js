// Berechnet die Gesamtstückzahl aus losen Flaschen + gezählten Gebinden
// product.gebinde: [{ label: 'Trag(l) 24er', units: 24 }, ...]
// gebindeCounts: { [gebindeLabel]: anzahl }
export function computeTotal(loose, gebindeCounts, product) {
  const looseNum = Number(loose) || 0;
  let gebindeTotal = 0;
  if (product?.gebinde?.length && gebindeCounts) {
    for (const g of product.gebinde) {
      const count = Number(gebindeCounts[g.label]) || 0;
      gebindeTotal += count * g.units;
    }
  }
  return looseNum + gebindeTotal;
}

export function formatDateTime(ts) {
  return new Date(ts).toLocaleString('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
