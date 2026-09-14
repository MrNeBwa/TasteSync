import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export const COLORS = {
  paper: '#F5F3ED',
  yellow: '#EFBD43',
  pink: '#E5679F',
  ink: '#111111',
  soft: '#D9D7D1',
  red: '#FFB9C3',
  green: '#BCEAB6',
};

export function Screen({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Header({ title, onPress }: { title: string; onPress?: () => void }) {
  return <View style={styles.header}><Text style={styles.headerTitle}>{title}</Text>{onPress ? <Pressable onPress={onPress} style={styles.headerIcon}><Text>⚙</Text></Pressable> : null}</View>;
}

export function Button({ children, onPress, variant = 'primary', disabled = false }: { children: React.ReactNode; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={[styles.button, variant === 'primary' && styles.primary, variant === 'danger' && styles.danger, variant === 'secondary' && styles.secondary, disabled && styles.disabled]}><Text style={styles.buttonText}>{children}</Text></Pressable>;
}

export function ErrorBox({ text }: { text: string }) { return <View style={styles.error}><Text style={styles.errorText}>{text}</Text></View>; }
export function Loading() { return <View style={styles.loading}><ActivityIndicator size="large" color={COLORS.ink} /><Text>Загружаем…</Text></View>; }

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.paper },
  header: { height: 68, backgroundColor: COLORS.yellow, borderBottomWidth: 2, borderBottomColor: COLORS.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  headerTitle: { fontSize: 20, fontWeight: '900' },
  headerIcon: { position: 'absolute', right: 18, width: 42, height: 42, borderWidth: 2, borderColor: COLORS.ink, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  button: { minHeight: 58, borderRadius: 18, borderWidth: 2, borderColor: COLORS.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primary: { backgroundColor: COLORS.yellow }, secondary: { backgroundColor: COLORS.soft }, danger: { backgroundColor: '#FF7377' }, disabled: { opacity: 0.45 },
  buttonText: { fontSize: 18, fontWeight: '800' },
  error: { borderWidth: 1.5, borderColor: '#C92E3A', backgroundColor: '#FFE0E4', borderRadius: 14, padding: 14 },
  errorText: { color: '#8F1722', lineHeight: 20 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
});
