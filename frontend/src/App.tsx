import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes';

import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <BrowserRouter>
      <Toaster position="bottom-right" />
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
