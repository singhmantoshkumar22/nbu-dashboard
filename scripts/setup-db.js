const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://fplgwpfujucoivmpvoas.supabase.co'
const supabaseServiceKey = 'sb_secret_KW0V-VCOj4cCbMwEipOvsg_YIuUTgPm'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupDatabase() {
  console.log('Setting up database tables...\n')

  // Test connection by trying to select from a system table
  const { data: test, error: testError } = await supabase
    .from('dashboards')
    .select('id')
    .limit(1)

  if (testError && testError.code === '42P01') {
    console.log('Tables do not exist. Please create them manually in Supabase SQL Editor.')
    console.log('\nGo to: https://supabase.com/dashboard/project/fplgwpfujucoivmpvoas/sql/new')
    console.log('\nAnd run the SQL from supabase-schema.sql')
    return
  }

  if (testError && testError.code !== 'PGRST116') {
    console.log('Connection test result:', testError)
  } else {
    console.log('Tables already exist!')
  }

  // Try to insert a test record to verify permissions
  const { data: insertTest, error: insertError } = await supabase
    .from('dashboards')
    .insert({
      file_name: 'test-connection',
      freight_booking: 0,
      gm2_percent: 0,
      pbt_percent: 0,
      otd_percent: 0,
      ifd_percent: 0,
      lhc_advance: 0,
    })
    .select()

  if (insertError) {
    if (insertError.code === '42P01') {
      console.log('\n❌ Tables do not exist yet.')
      console.log('\n📋 Please run the following SQL in Supabase SQL Editor:')
      console.log('   https://supabase.com/dashboard/project/fplgwpfujucoivmpvoas/sql/new\n')
    } else {
      console.log('Insert test error:', insertError)
    }
  } else {
    console.log('✅ Database connection and permissions verified!')

    // Clean up test record
    if (insertTest && insertTest[0]) {
      await supabase
        .from('dashboards')
        .delete()
        .eq('id', insertTest[0].id)
      console.log('✅ Test record cleaned up')
    }
  }
}

setupDatabase().catch(console.error)
