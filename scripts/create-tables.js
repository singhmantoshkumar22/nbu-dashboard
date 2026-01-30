const { Client } = require('pg')

// Supabase database connection
// You can find this in Supabase Dashboard > Settings > Database > Connection string
const connectionString = process.env.DATABASE_URL ||
  'postgresql://postgres.fplgwpfujucoivmpvoas:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'

const createTablesSQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Dashboards table (stores main metrics per upload)
CREATE TABLE IF NOT EXISTS dashboards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  file_name TEXT NOT NULL,
  freight_booking DECIMAL,
  gm2_percent DECIMAL,
  pbt_percent DECIMAL,
  otd_percent DECIMAL,
  ifd_percent DECIMAL,
  lhc_advance DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- KPI Data table (stores detailed KPI records)
CREATE TABLE IF NOT EXISTS kpi_data (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE,
  region TEXT,
  area TEXT,
  kpi TEXT,
  uom TEXT,
  fy25_budget DECIMAL,
  fy25_actual DECIMAL,
  variance DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Delivery KPI table (stores OTD and IFD data)
CREATE TABLE IF NOT EXISTS delivery_kpi (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE,
  region TEXT,
  area TEXT,
  plan DECIMAL,
  actual DECIMAL,
  variance DECIMAL,
  kpi_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Concerns table (stores concern items)
CREATE TABLE IF NOT EXISTS concerns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE,
  priority TEXT,
  region TEXT,
  area TEXT,
  kpi TEXT,
  actual TEXT,
  target TEXT,
  gap TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_kpi_data_dashboard_id ON kpi_data(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_delivery_kpi_dashboard_id ON delivery_kpi(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_delivery_kpi_type ON delivery_kpi(kpi_type);
CREATE INDEX IF NOT EXISTS idx_concerns_dashboard_id ON concerns(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_created_at ON dashboards(created_at DESC);
`

async function createTables() {
  const client = new Client({ connectionString })

  try {
    console.log('Connecting to database...')
    await client.connect()
    console.log('Connected!')

    console.log('Creating tables...')
    await client.query(createTablesSQL)
    console.log('✅ All tables created successfully!')

  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.message.includes('password authentication failed') ||
        error.message.includes('YOUR-PASSWORD')) {
      console.log('\n📋 To fix this:')
      console.log('1. Go to: https://supabase.com/dashboard/project/fplgwpfujucoivmpvoas/settings/database')
      console.log('2. Copy the "Connection string" (URI format)')
      console.log('3. Run: DATABASE_URL="your-connection-string" node scripts/create-tables.js')
    }
  } finally {
    await client.end()
  }
}

createTables()
