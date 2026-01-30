import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null

  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseAnonKey) {
      supabase = createClient(supabaseUrl, supabaseAnonKey)
    }
  }

  return supabase
}

export async function uploadFile(file: File): Promise<string | null> {
  const client = getSupabase()
  if (!client) {
    console.log('Supabase not initialized, skipping upload')
    return null
  }

  const fileName = `${Date.now()}_${file.name}`

  const { data, error } = await client.storage
    .from('excel-uploads')
    .upload(fileName, file)

  if (error) {
    console.error('Upload error:', error)
    return null
  }

  const { data: urlData } = client.storage
    .from('excel-uploads')
    .getPublicUrl(fileName)

  return urlData.publicUrl
}

export async function getFileUrl(fileName: string): Promise<string | null> {
  const client = getSupabase()
  if (!client) return null

  const { data } = client.storage
    .from('excel-uploads')
    .getPublicUrl(fileName)

  return data.publicUrl
}
