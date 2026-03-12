// @ts-nocheck
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Header from '../../components/header';

const BASE_URL = 'http://localhost:8000';

export default function OrdersScreen() {
  const navigation = useNavigation();
  const [orders, setOrders] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(6);
  const [totalCount, setTotalCount] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const fetchOrders = async (pageArg = page, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        if (!append) setOrders([]);
        return;
      }

      // Try paginated endpoint first
      const url = `${BASE_URL}/api/orders/?page=${pageArg}&page_size=${pageSize}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });

      // Support two shapes:
      // 1) Paginated: { results: [...], count: N, next: URL }
      // 2) Simple array: [...]
      if (Array.isArray(res.data)) {
        if (append) setOrders(prev => [...prev, ...res.data]); else setOrders(res.data || []);
        setTotalCount(res.data.length || 0);
      } else if (res.data.results && Array.isArray(res.data.results)) {
        if (append) setOrders(prev => [...prev, ...res.data.results]); else setOrders(res.data.results || []);
        setTotalCount(typeof res.data.count === 'number' ? res.data.count : null);
      } else if (res.data.orders && Array.isArray(res.data.orders)) {
        // Some APIs return { orders: [...] }
        if (append) setOrders(prev => [...prev, ...res.data.orders]); else setOrders(res.data.orders || []);
        setTotalCount(typeof res.data.count === 'number' ? res.data.count : null);
      } else {
        // fallback: set whatever came
        if (!append) setOrders(res.data || []);
      }

      setPage(pageArg);
    } catch (err) {
      console.log('Orders fetch error', err?.response?.data || err.message || err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('username').then(name => setCurrentUser(name));
      setPage(1);
      fetchOrders(1, false);
    }, [])
  );

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  
  const handlePrev = () => {
    if (page <= 1) return;
    fetchOrders(page - 1, false);
  };
  
  const handleNext = () => {
    // If we know totalCount, prevent going past last page
    if (totalCount && page * pageSize >= totalCount) return;
    fetchOrders(page + 1, false);
  };
  
  const handleLoadMore = () => {
    // Append next page
    if (totalCount && page * pageSize >= totalCount) return;
    fetchOrders(page + 1, true);
  };

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['token', 'username', 'refresh']);
    navigation.navigate('login');
  };

  const handleReorder = async (order) => {
    try {
      const itemCodes = order.items.map(i => i.item_code).filter(Boolean);
      if (itemCodes.length === 0) return;

      const res = await axios.post(`${BASE_URL}/api/products-by-codes/`, { item_codes: itemCodes });
      const products = res.data.products || [];

      const cartRaw = await AsyncStorage.getItem('cart');
      const cart = cartRaw ? JSON.parse(cartRaw) : {};

      products.forEach(product => {
        const orderItem = order.items.find(i => i.item_code === product.item_code);
        if (!orderItem) return;
        const qty = orderItem.qty || 1;
        const key = product.item_code;
        if (cart[key]) cart[key].qty += qty;
        else cart[key] = { item: product, qty };
      });

      await AsyncStorage.setItem('cart', JSON.stringify(cart));
      // navigate to checkout
      navigation.navigate('checkout');
    } catch (err) {
      console.log('Reorder error', err?.response?.data || err.message || err);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <Header currentUser={currentUser} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#2f8b3a" />
          <Text style={styles.loadingText}>Loading orders…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <Header currentUser={currentUser} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Your Orders</Text>
        <Text style={styles.subtitle}>Track, reorder or review past purchases</Text>

        {orders.length === 0 ? (
          <View style={styles.empty}> <Text style={styles.emptyText}>No orders found.</Text> </View>
        ) : (
          orders.map(order => {
            const isOpen = !!expanded[order.id];
            return (
              <View key={order.id} style={[styles.card, isOpen && styles.cardOpen]}>
                <TouchableOpacity style={styles.cardHeader} onPress={() => toggle(order.id)}>
                  <View style={styles.metaLeft}>
                    <Text style={styles.metaLabel}>ORDER ID</Text>
                    <Text style={styles.metaValue}>#{order.id}</Text>
                    <Text style={styles.metaSmall}>{order.date} • {order.time || ''}</Text>
                  </View>
                  <View style={styles.metaRight}>
                    <Text style={styles.metaLabel}>TOTAL</Text>
                    <Text style={styles.metaValue}>${(order.total || 0).toFixed(2)}</Text>
                    <Text style={styles.itemsPill}>{order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'items'}</Text>
                  </View>
                </TouchableOpacity>

                {isOpen && (
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
            );
          })
        )}
        {/* Pagination controls */}
        <View style={styles.paginationWrap}>
          <TouchableOpacity style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]} onPress={handlePrev} disabled={page <= 1 || loading}>
            <Text style={styles.pageBtnText}>Prev</Text>
          </TouchableOpacity>

          <Text style={styles.pageInfo}>Page {page}{totalCount ? ` of ${Math.ceil(totalCount / pageSize)}` : ''}</Text>

          <TouchableOpacity style={[styles.pageBtn, (totalCount && page * pageSize >= totalCount) && styles.pageBtnDisabled]} onPress={handleNext} disabled={(totalCount && page * pageSize >= totalCount) || loading}>
            <Text style={styles.pageBtnText}>Next</Text>
          </TouchableOpacity>
        </View>

        {/* Load more (append) */}
        {(!totalCount || page * pageSize < totalCount) && (
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <TouchableOpacity style={styles.loadMoreBtn} onPress={handleLoadMore} disabled={loadingMore || loading}>
              {loadingMore ? <ActivityIndicator color="#fff" /> : <Text style={styles.loadMoreText}>Load more</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafb' },
  container: { padding: 16, paddingBottom: 40 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#6b7176' },
  title: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  subtitle: { color: '#6b7176', marginBottom: 12 },
  empty: { marginTop: 40, alignItems: 'center' },
  emptyText: { color: '#6b7176' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#e0e3e6' },
  cardOpen: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  metaLeft: { flex: 1 },
  metaRight: { alignItems: 'flex-end' },
  metaLabel: { fontSize: 11, color: '#6b7176', fontWeight: '700' },
  metaValue: { fontSize: 15, fontWeight: '800', color: '#1A1A2E', marginTop: 4 },
  metaSmall: { color: '#6b7176', marginTop: 4 },
  itemsPill: { marginTop: 6, backgroundColor: 'rgba(47,139,58,0.08)', color: '#2f8b3a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16, fontWeight: '700' },
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
});
