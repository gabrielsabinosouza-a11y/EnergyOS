import * as Device from 'expo-device';
import { Platform } from 'react-native';

export const supportsBlur =
  Platform.OS === 'ios' &&
  Device.totalMemory !== null &&
  Device.totalMemory >= 3 * 1024 * 1024 * 1024;
