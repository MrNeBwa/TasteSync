import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../store/ThemeContext';
import type { Palette } from './Ui';

export function extractRoomCode(data: string): string | null {
  const trimmed = data.trim();
  const match = trimmed.match(/\/join\/([A-Za-z0-9]{4,8})/i);
  if (match) return match[1].toUpperCase();
  if (/^(MM:)?[A-Za-z0-9]{4,8}$/.test(trimmed)) return trimmed.replace(/^MM:/i, '').toUpperCase();
  return null;
}

export function QrScanModal({ visible, onClose, onScanned }: { visible: boolean; onClose: () => void; onScanned: (code: string) => void }) {
  const { palette } = useTheme();
  const s = makeStyles(palette);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible) {
      setScanned(false);
      if (!permission?.granted) requestPermission();
    }
  }, [visible, permission?.granted]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>Сканируйте QR-код комнаты</Text>
          <Text style={s.subtitle}>Наведите камеру на QR-код на экране друга.</Text>
          {permission?.granted ? (
            <View style={s.cameraWrap}>
              <CameraView
                style={s.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={scanned ? undefined : ({ data }) => {
                  const code = extractRoomCode(data);
                  if (!code) return;
                  setScanned(true);
                  onScanned(code);
                }}
              />
              <Text style={s.hint}>QR-код комнаты</Text>
            </View>
          ) : (
            <View style={s.cameraWrap}>
              {permission?.canAskAgain ? (
                <Pressable style={s.permissionButton} onPress={requestPermission}><Text style={s.permissionText}>Разрешить доступ к камере</Text></Pressable>
              ) : (
                <Text style={s.hint}>Нет доступа к камере. Выдайте разрешение в настройках телефона.</Text>
              )}
            </View>
          )}
          <Pressable style={s.close} onPress={onClose}><Text style={s.closeText}>Закрыть</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.55)', justifyContent: 'center', padding: 20 },
    card: { backgroundColor: c.paper, borderRadius: 24, borderWidth: 2, borderColor: c.ink, padding: 18, gap: 10 },
    title: { fontSize: 22, fontWeight: '900', color: c.ink },
    subtitle: { fontSize: 14, lineHeight: 20, color: c.ink === '#111111' ? '#5D5A52' : '#B3B0A8' },
    cameraWrap: { borderRadius: 18, overflow: 'hidden', borderWidth: 2, borderColor: c.ink, backgroundColor: '#000', minHeight: 260, alignItems: 'center', justifyContent: 'center' },
    camera: { width: '100%', height: 260 },
    hint: { position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 12, fontWeight: '700' },
    permissionButton: { padding: 16 },
    permissionText: { color: '#fff', fontWeight: '800', textAlign: 'center' },
    close: { minHeight: 48, borderRadius: 14, borderWidth: 2, borderColor: c.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: c.yellow },
    closeText: { fontSize: 16, fontWeight: '800', color: c.ink },
  });
}