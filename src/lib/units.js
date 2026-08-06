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

// Alle Daten zwischen dateStart und dateEnd (inkl.) als 'YYYY-MM-DD' Array
export function generateDateRange(dateStart, dateEnd) {
  if (!dateStart) return [];
  const dates = [];
  const cur = new Date(dateStart + 'T12:00:00');
  const last = new Date((dateEnd || dateStart) + 'T12:00:00');
  while (cur <= last) {
    dates.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    );
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
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
