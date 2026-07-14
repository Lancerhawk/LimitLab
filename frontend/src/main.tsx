import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Vyzora } from 'vyzora-sdk'

new Vyzora({ 
  apiKey: import.meta.env.VITE_VYZORA_KEY, 
  enabled: import.meta.env.VITE_VYZORA_ENABLED === 'true' 
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
