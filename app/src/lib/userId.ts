import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const KEY = 'booktracker_user_id';

export async function getUserId(): Promise<string> {
  let id = await SecureStore.getItemAsync(KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync(KEY, id);
  }
  return id;
}
