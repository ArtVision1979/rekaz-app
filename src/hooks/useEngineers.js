import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export function useEngineers() {
  const [engineers, setEngineers] = useState([])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .order('full_name')
      setEngineers(data || [])
    }
    load()
  }, [])

  return engineers
}
