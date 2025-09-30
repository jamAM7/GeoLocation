// src/screens/HomeScreen.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

// example places
const PLACES = [
  { id: 'p1', label: 'iOS Sim Location', lat: 37.785834, lon: -122.406417 },
  { id: 'p2', label: 'Sydney Opera',     lat: -33.856784, lon: 151.215297 },
  { id: 'p3', label: 'UTS Building 11',  lat: -33.883869, lon: 151.199111 },
];

// Uses the Haversine formula to calculate great-circle distance (in meters).
// In this project it's used in two ways:
//   1. To show the "true" distance between raw coordinates.
//   2. To approximate a "geohash distance" by measuring between the decoded cell centers of two geohashes.
const toRad = v => (v * Math.PI) / 180;
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// pure JS geohash (encode + decode to center)
// Base32 character set used in geohash
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
const CHAR_MAP = Object.fromEntries([...BASE32].map((ch, i) => [ch, i]));

function encodeGeohash(latitude, longitude, precision = 8) {
  let idx = 0, bit = 0, evenBit = true, geohash = '';
  let latMin = -90, latMax = 90;
  let lonMin = -180, lonMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      const mid = (lonMin + lonMax) / 2;
      if (longitude > mid) { idx = (idx << 1) + 1; lonMin = mid; }
      else { idx = (idx << 1); lonMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (latitude > mid) { idx = (idx << 1) + 1; latMin = mid; }
      else { idx = (idx << 1); latMax = mid; }
    }
    evenBit = !evenBit;

    if (++bit === 5) {
      geohash += BASE32.charAt(idx);
      bit = 0; idx = 0;
    }
  }
  return geohash;
}

function decodeGeohashCenter(hash) {
  let evenBit = true;
  let latMin = -90, latMax = 90;
  let lonMin = -180, lonMax = 180;

  for (const ch of hash) {
    const cd = CHAR_MAP[ch];
    if (cd == null) throw new Error('Invalid geohash character: ' + ch);

    for (let mask = 16; mask >= 1; mask >>= 1) {
      if (evenBit) {
        const mid = (lonMin + lonMax) / 2;
        if (cd & mask) lonMin = mid; else lonMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (cd & mask) latMin = mid; else latMax = mid;
      }
      evenBit = !evenBit;
    }
  }
  return { lat: (latMin + latMax) / 2, lon: (lonMin + lonMax) / 2 };
}

export default function HomeScreen() {
  const [coords, setCoords] = useState(null);     // {lat, lon, acc}
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [precision, setPrecision] = useState(8);  // change this and distance updates
  const [userHash, setUserHash] = useState(null);
  const [distanceM, setDistanceM] = useState(null); // geohash-based distance
  const [trueDistanceM, setTrueDistanceM] = useState(null); // conputes true distance (for comparison with geohash-based)


  const selectedPlace = useMemo(
    () => PLACES.find(p => p.id === selectedId) || null,
    [selectedId]
  );

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
    setUserHash(null);
    setDistanceM(null);

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
  }, []);

  // Recompute geohash + distance whenever coords, selected place, or precision changes
  useEffect(() => {
    if (!coords) return;

    const hash = encodeGeohash(coords.lat, coords.lon, precision);
    setUserHash(hash);

    if (selectedPlace) {
      // geohash-based distance
      const userCenter = decodeGeohashCenter(hash);
      const targetHash = encodeGeohash(selectedPlace.lat, selectedPlace.lon, precision);
      const targetCenter = decodeGeohashCenter(targetHash);
      const dGeo = haversineMeters(userCenter.lat, userCenter.lon, targetCenter.lat, targetCenter.lon);
      setDistanceM(dGeo);

      // true distance (raw coords vs target coords)
      const dTrue = haversineMeters(coords.lat, coords.lon, selectedPlace.lat, selectedPlace.lon);
      setTrueDistanceM(dTrue);
    } else {
      setDistanceM(null);
      setTrueDistanceM(null);
    }
  }, [coords, selectedPlace, precision]);

  const cyclePrecision = () => setPrecision(p => (p >= 12 ? 5 : p + 1));
  const fmtM = m => (m == null ? '—' : `${Math.round(m)} m`);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Text style={styles.title}>Geohash distance</Text>

      {/* place selector */}
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

      {/* controls */}
      <View style={{ flexDirection: 'row', marginBottom: 12 }}>
        <TouchableOpacity style={[styles.button, { marginRight: 8 }]} onPress={getLocation} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Getting location…' : 'Get Location'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, { backgroundColor: '#333' }]} onPress={cyclePrecision} disabled={loading}>
          <Text style={styles.buttonText}>Precision: {precision}</Text>
        </TouchableOpacity>
      </View>

      {/* coords of device */}
      {coords && (
        <Text style={styles.coords}>
          Lat: {coords.lat.toFixed(6)}{'\n'}
          Lon: {coords.lon.toFixed(6)}{'\n'}
          ±{Math.round(coords.acc)} m
        </Text>
      )}

      {/* geohash + distance */}
      {userHash && (
        <View style={styles.resultBox}>
          <Text style={styles.resultText}>
            Your geohash ({precision}): <Text style={styles.resultBold}>{userHash}</Text>
          </Text>


          {!selectedPlace ? (
            <Text style={[styles.resultText, { marginTop: 8 }]}>
              Select a target above to see distance.
            </Text>
          ) : (
            <>
              <Text style={[styles.resultText, { marginTop: 8 }]}>
                Geohash (p={precision}):{' '}
                <Text style={styles.resultBold}>
                  {distanceM != null ? `${Math.round(distanceM)} m` : '—'}
                </Text>
              </Text>

              <Text style={[styles.resultText, { marginTop: 4 }]}>
                True distance (Haversine):{' '}
                <Text style={styles.resultBold}>
                  {trueDistanceM != null ? `${Math.round(trueDistanceM)} m` : '—'}
                </Text>
              </Text>
            </>
          )}



        </View>
      )}

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
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16, textAlign: 'center' },

  boxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
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
  boxSelected: { backgroundColor: '#dbeafe', borderColor: '#93c5fd' },
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
