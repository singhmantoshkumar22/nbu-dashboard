import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function uploadFile(file: File): Promise<string | null> {
  const fileName = `${Date.now()}_${file.name}`

  const { data, error } = await supabase.storage
    .from('excel-uploads')
    .upload(fileName, file)

  if (error) {
    console.error('Upload error:', error)
    return null
  }

  const { data: urlData } = supabase.storage
    .from('excel-uploads')
    .getPublicUrl(fileName)

  return urlData.publicUrl
}

export async function getFileUrl(fileName: string): Promise<string> {
  const { data } = supabase.storage
    .from('excel-uploads')
    .getPublicUrl(fileName)

  return data.publicUrl
}
