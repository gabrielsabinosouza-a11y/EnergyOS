import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { ApiError, api } from '@/shared/api';
import { Button, Card, EmptyState, ErrorState, Screen, Text } from '@/shared/components';
import { useTheme } from '@/hooks/use-theme';

type StoreItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  rarity: string;
  owned: boolean;
  equipped: boolean;
};

type StoreState = {
  items: StoreItem[];
  balance: number;
  shieldCount: number;
  ownedAuras: string[];
};

function errorText(error: unknown) {
  return error instanceof ApiError ? error.message : 'Não foi possível concluir a compra.';
}

export default function StoreScreen() {
  const theme = useTheme();
  const [store, setStore] = useState<StoreState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setStore(await api.get<StoreState>('/api/store'));
      setError('');
    } catch (loadError) {
      setError(errorText(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function buyDecoration(item: StoreItem) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.post('/api/store/decorations', { decorationId: item.id });
      setNotice(`${item.name} foi adquirido.`);
      await load();
    } catch (purchaseError) {
      setError(errorText(purchaseError));
    } finally {
      setBusy(false);
    }
  }

  async function toggleDecoration(item: StoreItem) {
    setBusy(true);
    setError('');
    try {
      await api.patch('/api/store/decorations', { decorationId: item.equipped ? null : item.id });
      await load();
    } catch (equipError) {
      setError(errorText(equipError));
    } finally {
      setBusy(false);
    }
  }

  async function buyShield() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.post('/api/store/shields', {});
      setNotice('Escudo adquirido.');
      await load();
    } catch (purchaseError) {
      setError(errorText(purchaseError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          colors={[theme.accent]}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          refreshing={refreshing}
          tintColor={theme.accent}
        />
      }>
      <View style={styles.heading}>
        <Text color={theme.orange} variant="eyebrow">ENERGIA E RECOMPENSAS</Text>
        <Text variant="title">Loja</Text>
        <Text color={theme.textSecondary}>Use suas moedas. O saldo e as compras são confirmados pela sua conta.</Text>
      </View>
      {store ? (
        <Card style={styles.balance}>
          <View style={styles.copy}>
            <Text color={theme.textSecondary} variant="caption">SEU SALDO</Text>
            <Text color={theme.orange} variant="heading">{store.balance} moedas</Text>
          </View>
          <View style={styles.copy}>
            <Text color={theme.textSecondary} variant="caption">ESCUDOS</Text>
            <Text color={theme.accent} variant="heading">{store.shieldCount}</Text>
          </View>
        </Card>
      ) : null}
      {error ? <ErrorState description={error} onRetry={() => void load()} title="Loja indisponível" /> : null}
      {notice ? <Text accessibilityLiveRegion="polite" color={theme.green}>{notice}</Text> : null}
      <Card style={styles.item}>
        <View style={styles.copy}>
          <Text variant="label">Escudo de sequência</Text>
          <Text color={theme.textSecondary}>Proteja uma sequência quando precisar pausar.</Text>
        </View>
        <Button disabled={busy} loading={busy} onPress={buyShield} title="Comprar" variant="secondary" />
      </Card>
      <Text variant="sectionTitle">Decorações</Text>
      {!loading && store?.items.length === 0 ? <EmptyState description="Novos itens aparecerão aqui." title="Nenhum item disponível" /> : null}
      {store?.items.map((item) => (
        <Card key={item.id} style={styles.item}>
          <View style={styles.copy}>
            <Text variant="label">{item.name}{item.equipped ? ' · equipado' : ''}</Text>
            <Text color={theme.textSecondary}>{item.description}</Text>
            <Text color={theme.purple} variant="caption">{item.rarity} · {item.price} moedas</Text>
          </View>
          {item.owned ? (
            <Button disabled={busy} loading={busy} onPress={() => void toggleDecoration(item)} title={item.equipped ? 'Remover' : 'Equipar'} variant="secondary" />
          ) : (
            <Button disabled={busy} loading={busy} onPress={() => void buyDecoration(item)} title="Comprar" />
          )}
        </Card>
      ))}
      {loading && !store ? <Text color={theme.textSecondary}>Carregando loja…</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 10, paddingTop: 8 },
  balance: { flexDirection: 'row', justifyContent: 'space-between' },
  item: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  copy: { flex: 1, gap: 5 },
});
