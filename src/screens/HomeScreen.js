// src/screens/HomeScreen.js
import React, { useCallback, useState } from 'react';
import {
  SafeAreaView,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
  View,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';

const THRESHOLD_METERS = 50;

// Replace these with your own locations
const PLACES = [
  { id: 'p1', label: 'iOS Sim Location',     lat: 37.785834,    lon: -122.406417 },
  { id: 'p2', label: 'Sydney Opera',   lat: -33.856784, lon: 151.215297 },
  { id: 'p3', label: 'UTS Building 11',  lat: -33.883869,   lon: 151.199111 },
];


// Haversine distance in meters
const toRad = v => (v * Math.PI) / 180;
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function HomeScreen() {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [result, setResult] = useState(null); // { label, distance }

  const selectedPlace = PLACES.find(p => p.id === selectedId) || null;

  const requestAndroidPermission = async () => {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'We need your permission to get your location.',
        buttonPositive: 'OK',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const getLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCoords(null);
    setResult(null);

    try {
      const ok = await requestAndroidPermission();
      if (!ok) {
        setError('Location permission denied');
        setLoading(false);
        return;
      }

      Geolocation.getCurrentPosition(
        pos => {
          const c = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            acc: pos.coords.accuracy,
          };
          setCoords(c);

          if (selectedPlace) {
            const d = distanceMeters(c.lat, c.lon, selectedPlace.lat, selectedPlace.lon);
            setResult({ label: selectedPlace.label, distance: d });
          } else {
            setResult({ label: null, distance: null });
          }

          setLoading(false);
        },
        e => {
          setError(e.message);
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  }, [selectedPlace]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Text style={styles.title}>Press for geo location</Text>

      {/* Target boxes */}
      <View style={styles.boxRow}>
        {PLACES.map(place => {
          const selected = place.id === selectedId;
          return (
            <TouchableOpacity
              key={place.id}
              style={[styles.box, selected && styles.boxSelected]}
              onPress={() => setSelectedId(place.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.boxLabel, selected && styles.boxLabelSelected]}>
                {place.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Get Location button */}
      <TouchableOpacity style={styles.button} onPress={getLocation} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Getting location…' : 'Get Location'}</Text>
      </TouchableOpacity>

      {/* Your coordinates */}
      {coords && (
        <Text style={styles.coords}>
          Lat: {coords.lat.toFixed(6)}{'\n'}
          Lon: {coords.lon.toFixed(6)}{'\n'}
          ±{Math.round(coords.acc)} m
        </Text>
      )}

      {/* Result + target coordinates */}
      <View style={styles.resultBox}>
        {!selectedPlace ? (
          <Text style={styles.resultText}>Select a target above to check distance.</Text>
        ) : result && result.distance != null ? (
          Math.round(result.distance) <= THRESHOLD_METERS ? (
            <Text style={styles.resultText}>
              ✅ You are within {THRESHOLD_METERS} m of <Text style={styles.resultBold}>{result.label}</Text>{' '}
              ({Math.round(result.distance)} m).
            </Text>
          ) : (
            <Text style={styles.resultText}>
              ❌ You are <Text style={styles.resultBold}>{Math.round(result.distance)} m</Text> away from{' '}
              <Text style={styles.resultBold}>{result.label}</Text>.
            </Text>
          )
        ) : (
          <Text style={styles.resultText}>Tap “Get Location” to measure distance.</Text>
        )}

        {selectedPlace && (
          <Text style={styles.targetCoords}>
            Target ({selectedPlace.label}): {selectedPlace.lat.toFixed(6)}, {selectedPlace.lon.toFixed(6)}
          </Text>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
    </SafeAreaView>
  );
}

const BOX_SIZE = 104;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16, textAlign: 'center' },

  boxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  box: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d4d4d8',
    backgroundColor: '#f4f4f5',
    marginHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  boxSelected: {
    backgroundColor: '#dbeafe', // light blue
    borderColor: '#93c5fd',
  },
  boxLabel: { textAlign: 'center', fontWeight: '600', color: '#111827' },
  boxLabelSelected: { color: '#1e3a8a' },

  button: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#111',
    marginBottom: 12,
  },
  buttonText: { color: '#fff', fontWeight: '600' },

  coords: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },

  resultBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    minWidth: 260,
  },
  resultText: { textAlign: 'center' },
  resultBold: { fontWeight: '700' },
  targetCoords: { marginTop: 6, textAlign: 'center', color: '#374151' },

  error: { marginTop: 8, color: '#d00', textAlign: 'center' },
});
