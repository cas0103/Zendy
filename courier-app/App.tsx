import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as api from "./api";

export default function App() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    api.hasToken().then((has) => {
      setLoggedIn(has);
      setCheckingSession(false);
    });
  }, []);

  if (checkingSession) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return loggedIn ? (
    <HomeScreen onLoggedOut={() => setLoggedIn(false)} />
  ) : (
    <LoginScreen onLoggedIn={() => setLoggedIn(true)} />
  );
}

function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    try {
      await api.login(phone, password);
      onLoggedIn();
    } catch (e: any) {
      Alert.alert("Inloggen mislukt", e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.center}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Zenddy Koerier</Text>
      <TextInput
        style={styles.input}
        placeholder="Telefoonnummer"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Wachtwoord"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
      />
      <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Bezig..." : "Inloggen"}</Text>
      </Pressable>
    </View>
  );
}

function HomeScreen({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [me, setMe] = useState<api.Courier | null>(null);
  const [offers, setOffers] = useState<api.CourierOffer[]>([]);
  const [activeOrder, setActiveOrder] = useState<api.Order | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [meData, offerData, orderData] = await Promise.all([
      api.getMe(),
      api.getMyOffers(),
      api.getActiveOrder(),
    ]);
    setMe(meData);
    setOffers(orderData ? [] : offerData);
    setActiveOrder(orderData);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  }

  async function toggleOnline(value: boolean) {
    const updated = await api.setStatus(value ? "online_available" : "offline");
    setMe(updated);
  }

  async function respond(offerId: string, response: "accepted" | "declined") {
    setBusyOfferId(offerId);
    try {
      await api.respondToOffer(offerId, response);
      await load();
    } catch (e: any) {
      Alert.alert("Kon niet verwerken", e.message);
    } finally {
      setBusyOfferId(null);
    }
  }

  async function confirmDelivered() {
    if (!activeOrder) return;
    try {
      await api.markDelivered(activeOrder.id);
      await load();
    } catch (e: any) {
      Alert.alert("Kon niet bevestigen", e.message);
    }
  }

  async function handleLogout() {
    await api.logout();
    onLoggedOut();
  }

  if (!me) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <StatusBar style="dark" />
      <View style={styles.headerRow}>
        <Text style={styles.title}>Hoi, {me.name}</Text>
        <Pressable onPress={handleLogout}>
          <Text style={styles.link}>Uitloggen</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Online en beschikbaar</Text>
          <Switch
            value={me.status !== "offline"}
            onValueChange={toggleOnline}
            disabled={me.status === "on_delivery"}
          />
        </View>
        <Text style={styles.subtle}>Status: {me.status}</Text>
      </View>

      {activeOrder && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Actieve rit — {activeOrder.external_order_ref}</Text>
          <Text style={styles.subtle}>{activeOrder.delivery_address}</Text>
          <Text style={styles.badge}>{activeOrder.status}</Text>
          {activeOrder.status === "ONDERWEG_NAAR_KLANT" && (
            <Pressable style={styles.button} onPress={confirmDelivered}>
              <Text style={styles.buttonText}>Bevestig aflevering</Text>
            </Pressable>
          )}
          {activeOrder.status === "KLAARSTAAN_VOOR_OPHALEN" && (
            <Text style={styles.subtle}>Wachten tot de winkel het ophalen bevestigt...</Text>
          )}
        </View>
      )}

      {!activeOrder && offers.length === 0 && (
        <Text style={styles.subtle}>Geen openstaande ritaanbiedingen.</Text>
      )}

      {offers.map((offer) => (
        <View key={offer.id} style={styles.card}>
          <Text style={styles.cardTitle}>Nieuwe rit beschikbaar!</Text>
          <Text style={styles.subtle}>Aanbod verloopt om {new Date(offer.expires_at).toLocaleTimeString("nl-NL")}</Text>
          <View style={styles.rowBetween}>
            <Pressable
              style={[styles.button, styles.declineButton]}
              onPress={() => respond(offer.id, "declined")}
              disabled={busyOfferId === offer.id}
            >
              <Text style={styles.buttonText}>Weigeren</Text>
            </Pressable>
            <Pressable
              style={styles.button}
              onPress={() => respond(offer.id, "accepted")}
              disabled={busyOfferId === offer.id}
            >
              <Text style={styles.buttonText}>Accepteren</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", padding: 24 },
  screen: { flexGrow: 1, backgroundColor: "#f5f5f7", padding: 20, paddingTop: 60 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "700" },
  link: { color: "#0077cc", fontWeight: "600" },
  input: {
    width: "100%",
    maxWidth: 320,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  button: {
    backgroundColor: "#111",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    alignItems: "center",
  },
  declineButton: { backgroundColor: "#999" },
  buttonText: { color: "#fff", fontWeight: "600" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  subtle: { color: "#666", fontSize: 13, marginBottom: 4 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#e6a700",
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 8,
  },
});
