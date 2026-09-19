import { Stack } from 'expo-router';
import { AuthProvider } from '../src/store/AuthContext';
import { ThemeProvider } from '../src/store/ThemeContext';

export default function Layout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
      </AuthProvider>
    </ThemeProvider>
  );
}