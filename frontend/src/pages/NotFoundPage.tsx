import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex h-[80vh] flex-col items-center justify-center space-y-4 text-center">
      <div className="space-y-2">
        <h1 className="text-8xl font-bold tracking-tighter text-primary">404</h1>
        <h2 className="text-2xl font-semibold tracking-tight">Page not found</h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          The page you are looking for doesn't exist or has been moved.
        </p>
      </div>
      <Button onClick={() => navigate('/dashboard')} size="lg" className="mt-8">
        Return to Dashboard
      </Button>
    </div>
  );
};

export default NotFoundPage;
