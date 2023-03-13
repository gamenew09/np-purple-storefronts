import { library } from '@fortawesome/fontawesome-svg-core'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { SessionContextProvider } from '@supabase/auth-helpers-react'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { supabaseClient } from './supabaseClient'

library.add(fas);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <SessionContextProvider supabaseClient={supabaseClient}>
      <App />
    </SessionContextProvider>
  </React.StrictMode>,
)
