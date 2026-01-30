const XLSX = require('xlsx');
const fs = require('fs');

const filePath = '/Users/mantosh/Downloads/NBU - Weekly Business Tracker.xlsx';
const buffer = fs.readFileSync(filePath);
const workbook = XLSX.read(buffer, { type: 'buffer' });

console.log('=== SHEETS ===');
console.log(workbook.SheetNames);

if (workbook.SheetNames.includes('Weekly Business Tracker')) {
  const sheet = workbook.Sheets['Weekly Business Tracker'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  console.log(`\n=== DATA SHAPE ===`);
  console.log(`Rows: ${data.length}, Cols: ${data[0]?.length || 0}`);

  // Find week columns in row 0
  const row0 = data[0] || [];
  const weekColumns = [];

  for (let j = 0; j < row0.length; j++) {
    const header = String(row0[j] || '');
    const weekMatch = header.match(/Week\s*-?\s*(\d+)/i);
    if (weekMatch) {
      weekColumns.push({ col: j, weekNum: parseInt(weekMatch[1]) });
    }
  }

  console.log(`\n=== WEEK COLUMNS ===`);
  console.log(`Total week columns: ${weekColumns.length}`);
  if (weekColumns.length > 0) {
    console.log(`Week range: ${Math.min(...weekColumns.map(w => w.weekNum))} to ${Math.max(...weekColumns.map(w => w.weekNum))}`);
  }

  const w43 = weekColumns.find(w => w.weekNum === 43);
  console.log(`Week 43 column: ${w43 ? w43.col : 'NOT FOUND'}`);

  // Check Week 43 data extraction
  const trackableKPIs = ['Freight Booking', 'GM2% on Sale', 'EstimatedPBT%', 'LHC Advance %'];
  let currentRegion = '';
  const freightData = [];

  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;

    if (row[0] && String(row[0]).trim()) {
      currentRegion = String(row[0]).trim();
    }

    const area = row[1] ? String(row[1]).trim() : '';
    const kpi = row[3] ? String(row[3]).trim() : '';

    if (!kpi || kpi === 'KPI') continue;

    if (kpi === 'Freight Booking' && w43) {
      const actualVal = row[w43.col + 1];
      if (typeof actualVal === 'number' && !isNaN(actualVal)) {
        freightData.push({ row: i, region: currentRegion, area, actual: actualVal });
      }
    }
  }

  console.log(`\n=== FREIGHT BOOKING WEEK 43 ===`);
  console.log(`Total areas: ${freightData.length}`);
  let total = 0;
  for (const d of freightData) {
    console.log(`  Row ${d.row}: ${d.area} = ${d.actual.toFixed(2)}`);
    total += d.actual;
  }
  console.log(`\n=== TOTAL: ${total.toFixed(2)} Cr ===`);
}
