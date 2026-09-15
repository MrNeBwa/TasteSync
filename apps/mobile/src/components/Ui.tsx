import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../store/ThemeContext';

export type Palette = { paper: string; yellow: string; pink: string; ink: string; soft: string; red: string; green: string };

export const COLORS: Palette = {
  paper: '#F5F3ED',
  yellow: '#EFBD43',
  pink: '#E5679F',
  ink: '#111111',
  soft: '#D9D7D1',
  red: '#FFB9C3',
  green: '#BCEAB6',
};

export const DARK_COLORS: Palette = {
  paper: '#16181D',
  yellow: '#EFBD43',
  pink: '#E5679F',
  ink: '#ECE9E1',
  soft: '#262B33',
  red: '#FFB9C3',
  green: '#BCEAB6',
};

function usePaletteStyles<T>(make: (c: Palette) => T): T {
  const { palette } = useTheme();
  return make(palette);
}

export function Screen({ children }: { children: React.ReactNode }) {
  const styles = usePaletteStyles(makeScreenStyles);
  return <View style={styles.screen}>{children}</View>;
}

export function Header({ title, onPress }: { title: string; onPress?: () => void }) {
  const { palette } = useTheme();
  const styles = makeHeaderStyles(palette);
  return <View style={styles.header}><Text style={styles.headerTitle}>{title}</Text>{onPress ? <Pressable onPress={onPress} style={styles.headerIcon}><Text style={{ color: palette.ink }}>⚙</Text></Pressable> : null}</View>;
}

export function Button({ children, onPress, variant = 'primary', disabled = false }: { children: React.ReactNode; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean }) {
  const { palette } = useTheme();
  const styles = makeButtonStyles(palette);
  const styleVariant = variant === 'danger' ? styles.danger : variant === 'secondary' ? styles.secondary : styles.primary;
  return <Pressable onPress={onPress} disabled={disabled} style={[styles.button, styleVariant, disabled && styles.disabled]}><Text style={[styles.buttonText, variant === 'secondary' && { color: palette.ink }]}>{children}</Text></Pressable>;
}

export function ErrorBox({ text }: { text: string }) {
  const { palette } = useTheme();
  const styles = makeErrorStyles(palette);
  return <View style={styles.error}><Text style={styles.errorText}>{text}</Text></View>;
}
export function Loading() {
  const { palette } = useTheme();
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}><ActivityIndicator size="large" color={palette.ink} /><Text style={{ color: palette.ink }}>Загружаем…</Text></View>;
}

function makeScreenStyles(c: Palette) {
  return StyleSheet.create({ screen: { flex: 1, backgroundColor: c.paper } });
}
function makeHeaderStyles(c: Palette) {
  return StyleSheet.create({
    header: { height: 68, backgroundColor: c.yellow, borderBottomWidth: 2, borderBottomColor: c.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
    headerTitle: { fontSize: 20, fontWeight: '900', color: c.ink },
    headerIcon: { position: 'absolute', right: 18, width: 42, height: 42, borderWidth: 2, borderColor: c.ink, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.paper },
  });
}
function makeButtonStyles(c: Palette) {
  return StyleSheet.create({
    button: { minHeight: 58, borderRadius: 18, borderWidth: 2, borderColor: c.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
    primary: { backgroundColor: c.yellow }, secondary: { backgroundColor: c.soft }, danger: { backgroundColor: '#FF7377' }, disabled: { opacity: 0.45 },
    buttonText: { fontSize: 18, fontWeight: '800', color: c.ink },
  });
}
function makeErrorStyles(c: Palette) {
  return StyleSheet.create({
    error: { borderWidth: 1.5, borderColor: '#C92E3A', backgroundColor: c.paper, borderRadius: 14, padding: 14 },
    errorText: { color: '#B31F2D', lineHeight: 20 },
  });
}