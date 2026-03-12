// @ts-nocheck
import Header from '@/components/header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCart } from "../../context/CartContext";

const BASE_URL = 'http://localhost:8000';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const [username, setUsername] = useState<string | null>(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize] = useState(6);
  const [totalCount, setTotalCount] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const { cart, setCart } = useCart();

  const fetchOrders = async (pageArg = page, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        if (!append) setOrders([]);
        return;
      }

      const url = `${BASE_URL}/api/orders/?page=${pageArg}&page_size=${pageSize}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });

      if (Array.isArray(res.data)) {
        if (append) setOrders(prev => [...prev, ...res.data]); else setOrders(res.data || []);
        setTotalCount(res.data.length || 0);
      } else if (res.data.results && Array.isArray(res.data.results)) {
        if (append) setOrders(prev => [...prev, ...res.data.results]); else setOrders(res.data.results || []);
        setTotalCount(typeof res.data.count === 'number' ? res.data.count : null);
      } else if (res.data.orders && Array.isArray(res.data.orders)) {
        if (append) setOrders(prev => [...prev, ...res.data.orders]); else setOrders(res.data.orders || []);
        setTotalCount(typeof res.data.count === 'number' ? res.data.count : null);
      } else {
        if (!append) setOrders(res.data || []);
      }

      setPage(pageArg);
    } catch (err) {
      console.log('Profile orders fetch error', err?.response?.data || err.message || err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('username').then((u) => {
        setUsername(u);
        if (!u) {
          // if no user, redirect to login
          navigation.navigate('login');
        }
      });
      setPage(1);
      fetchOrders(1, false);
    }, [])
  );

  // const handleReorder = async (order) => {
  //   try {
  //     const itemCodes = order.items.map(i => i.item_code).filter(Boolean);
  //     if (itemCodes.length === 0) return;
  //     const res = await axios.post(`${BASE_URL}/api/products-by-codes/`, { item_codes: itemCodes });
  //     const products = res.data.products || [];

  //     const cartRaw = await AsyncStorage.getItem('cart');
  //     const cart = cartRaw ? JSON.parse(cartRaw) : {};

  //     products.forEach(product => {
  //       const orderItem = order.items.find(i => i.item_code === product.item_code);
  //       if (!orderItem) return;
  //       const qty = orderItem.qty || 1;
  //       const key = product.item_code;
  //       if (cart[key]) cart[key].qty += qty;
  //       else cart[key] = { item: product, qty };
  //     });

  //     await AsyncStorage.setItem('cart', JSON.stringify(cart));
  //     navigation.navigate('checkout');
  //   } catch (err) {
  //     console.log('Reorder error', err?.response?.data || err.message || err);
  //   }
  // };

  const handleReorder = async (order) => {
    try {

      const itemCodes = order.items.map(i => i.item_code).filter(Boolean);
      if (!itemCodes.length) return;

      const res = await axios.post(`${BASE_URL}/api/products-by-codes/`, {
        item_codes: itemCodes
      });

      const products = res.data.products || [];

      const updatedCart = { ...cart };

      products.forEach(product => {

        const orderItem = order.items.find(i => i.item_code === product.item_code);
        if (!orderItem) return;

        const key = product.item_code;
        const orderQty = orderItem.qty || 1;
        const stock = product.stock || 0;

        const existingQty = updatedCart[key]?.qty || 0;

        let newQty = existingQty + orderQty;

        // STOCK LIMIT
        if (newQty > stock) {
          newQty = stock;
        }

        if (newQty > 0) {
          updatedCart[key] = {
            item: product,
            qty: newQty
          };
        }
      });

      // update context
      setCart(updatedCart);

      // persist
      await AsyncStorage.setItem("cart", JSON.stringify(updatedCart));

      navigation.navigate("checkout");

    } catch (err) {
      console.log("Reorder error", err?.response?.data || err.message || err);
    }
  };

  const toggleOrder = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePrev = () => {
    if (page <= 1) return;
    fetchOrders(page - 1, false);
  };

  const handleNext = () => {
    if (totalCount && page * pageSize >= totalCount) return;
    fetchOrders(page + 1, false);
  };

  const handleLoadMore = () => {
    if (totalCount && page * pageSize >= totalCount) return;
    fetchOrders(page + 1, true);
  };

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['token', 'username', 'refresh']);
    setUsername(null);
    setOrders([]);
    navigation.navigate('login');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafb' }}>
      <Header currentUser={username} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <ThemedText type="title">{username ? `Hi, ${username}` : 'Profile'}</ThemedText>
            <Text style={styles.subtitle}>{username ? 'Your recent orders are shown below.' : 'Sign in to see your orders.'}</Text>
          </View>
          {username ? (
            <Pressable style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutBtnText}>Logout</Text>
            </Pressable>
          ) : null}
        </ThemedView>

        {loading ? (
          <View style={styles.loadingWrap}><ActivityIndicator size="large" color="#2f8b3a" /></View>
        ) : (
          orders.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyText}>No orders found.</Text></View>
          ) : (
            orders.map(order => (
              <View key={order.id} style={styles.card}>
                <TouchableOpacity style={styles.cardHeader} onPress={() => toggleOrder(order.id)} activeOpacity={0.8}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.metaLabel}>ORDER</Text>
                    <Text style={styles.metaValue}>#{order.id}</Text>
                    <Text style={styles.metaSmall}>{order.date} • {order.time || ''}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.metaLabel}>TOTAL</Text>
                    <Text style={styles.metaValue}>${(order.total || 0).toFixed(2)}</Text>
                    <Text style={styles.itemsPill}>{order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'items'}</Text>
                    <Text style={styles.chev}>{expanded[order.id] ? '▲' : '▼'}</Text>
                  </View>
                </TouchableOpacity>

                {expanded[order.id] && (
                  <View style={styles.cardBody}>
                    <ScrollView
                      style={[styles.itemsScroll, Platform.OS === 'web' && styles.itemsScrollWeb]}
                      contentContainerStyle={{ paddingBottom: 12 }}
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                    >
                      {order.items.map((it, idx) => (
                        <View key={idx} style={styles.itemRow}>
                          <Image source={{ uri: it.image }} style={styles.itemImg} />
                          <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{it.name}</Text>
                            <Text style={styles.itemDetails}>{it.details}</Text>
                          </View>
                          <View style={styles.itemMeta}>
                            <Text style={styles.itemPrice}>${(it.price || 0).toFixed(2)}</Text>
                            <Text style={styles.itemQty}>Qty: {it.qty}</Text>
                          </View>
                        </View>
                      ))}
                    </ScrollView>

                    <View style={styles.cardActions}>
                      <TouchableOpacity style={styles.reorderBtn} onPress={() => handleReorder(order)}>
                        <Text style={styles.reorderBtnText}>Reorder</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ))
          )
        )}
        {/* Pagination bar like products page */}
        <View style={styles.paginationBar}>
          <TouchableOpacity onPress={handlePrev} disabled={page <= 1 || loading}>
            <Text style={[styles.prevText, (page <= 1 || loading) && styles.disabledText]}>← Previous</Text>
          </TouchableOpacity>

          <Text style={styles.pageIndicator}>{page}{totalCount ? ` / ${Math.max(1, Math.ceil(totalCount / pageSize))}` : ''}</Text>

          <TouchableOpacity onPress={handleNext} disabled={(totalCount && page * pageSize >= totalCount) || loading}>
            <Text style={[styles.nextText, ((totalCount && page * pageSize >= totalCount) || loading) && styles.disabledText]}>Next →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 120 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subtitle: { color: '#6b7176', marginTop: 6, marginBottom: 12 },
  loadingWrap: { marginTop: 24, alignItems: 'center' },
  empty: { marginTop: 24, alignItems: 'center' },
  emptyText: { color: '#6b7176' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#e0e3e6' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  metaLabel: { fontSize: 11, color: '#6b7176', fontWeight: '700' },
  metaValue: { fontSize: 15, fontWeight: '800', color: '#1A1A2E', marginTop: 4 },
  metaSmall: { color: '#6b7176', marginTop: 4 },
  itemsPill: { marginTop: 6, backgroundColor: 'rgba(47,139,58,0.08)', color: '#2f8b3a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16, fontWeight: '700' },
  chev: { marginTop: 8, color: '#6b7176', fontSize: 12, fontWeight: '700' },
  logoutBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#e0e3e6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  logoutBtnText: { color: '#D32F2F', fontWeight: '700' },
  cardBody: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  itemImg: { width: 64, height: 64, borderRadius: 8, marginRight: 12, backgroundColor: '#f6f6f6' },
  itemInfo: { flex: 1 },
  itemName: { fontWeight: '700', color: '#1A1A2E' },
  itemDetails: { color: '#6b7176', marginTop: 4 },
  itemMeta: { alignItems: 'flex-end' },
  itemPrice: { fontWeight: '800', color: '#2f8b3a' },
  itemQty: { color: '#6b7176', marginTop: 6 },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
  reorderBtn: { backgroundColor: '#2f8b3a', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  reorderBtnText: { color: '#fff', fontWeight: '800' },
  itemsScroll: { maxHeight: 240, marginRight: -8, paddingRight: 8 },
  itemsScrollWeb: { overflow: 'auto' },
  paginationWrap: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  pageBtn: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e3e6', borderRadius: 8 },
  pageBtnDisabled: { opacity: 0.5 },
  pageBtnText: { color: '#1A1A2E', fontWeight: '700' },
  pageInfo: { color: '#6b7176', fontWeight: '700' },
  loadMoreBtn: { backgroundColor: '#2f8b3a', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
  loadMoreText: { color: '#fff', fontWeight: '800' },
  paginationBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingVertical: 12, paddingHorizontal: 8, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#f0f0f0' },
  prevText: { color: '#2f8b3a', fontWeight: '700' },
  nextText: { color: '#2f8b3a', fontWeight: '700' },
  pageIndicator: { fontWeight: '800', color: '#1A1A2E' },
  disabledText: { opacity: 0.4 },
});
