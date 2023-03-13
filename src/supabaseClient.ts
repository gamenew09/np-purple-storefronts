import {createClient} from '@supabase/supabase-js'
import { Database } from './database.types';

interface SupabaseEnvVars {
    readonly VITE_REACT_APP_SUPABASE_URL?: string;
    readonly VITE_REACT_APP_SUPABASE_ANON_KEY?: string;
}

const { VITE_REACT_APP_SUPABASE_ANON_KEY: REACT_APP_SUPABASE_ANON_KEY, VITE_REACT_APP_SUPABASE_URL: REACT_APP_SUPABASE_URL } = import.meta.env as SupabaseEnvVars;

if(REACT_APP_SUPABASE_ANON_KEY === undefined)
    throw new Error("REACT_APP_SUPABASE_ANON_KEY is undefined.");

if(REACT_APP_SUPABASE_URL === undefined)
    throw new Error("REACT_APP_SUPABASE_ANON_KEY is undefined.");

export const supabaseClient = createClient<Database>(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY);