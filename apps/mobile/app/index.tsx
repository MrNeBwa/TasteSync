import { Redirect } from 'expo-router';
import { Loading } from '../src/components/Ui';
import { useAuth } from '../src/store/AuthContext';

export default function Index() {
  const { loading, user } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/auth" />;
  return <Redirect href={user.birth_date ? '/home' : '/age-gate'} />;
}
