"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import type { StaffProfile, TimeSlot, Booking, EventType, BookingStatus, StaffRole } from "@/types";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, deleteDoc, getDocs, writeBatch } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { DEMO_STAFF_PROFILES, DEMO_STAFF_ROLES, DEMO_TIME_SLOTS, DEMO_BOOKINGS } from "@/lib/demoData";

// =============================================
// ScheduleContext
// =============================================

interface ScheduleContextType {
  staffProfiles: StaffProfile[];
  timeSlots: TimeSlot[];
  bookings: Booking[];
  staffRoles: StaffRole[];
  // ロール管理
  addStaffRole: (name: string) => void;
  updateStaffRole: (id: string, updates: Partial<StaffRole>) => void;
  deleteStaffRole: (id: string) => void;
  // スタッフプロフィール
  addStaffProfile: (profile: Omit<StaffProfile, "id">) => void;
  updateStaffProfile: (id: string, updates: Partial<StaffProfile>) => void;
  deleteStaffProfile: (id: string) => void;
  // タイムスロット
  addTimeSlot: (slot: Omit<TimeSlot, "id">) => void;
  addTimeSlots: (slots: Omit<TimeSlot, "id">[]) => void;
  deleteTimeSlot: (id: string) => void;
  getSlotsByStaff: (staffId: string) => TimeSlot[];
  getAvailableSlots: (eventType?: EventType) => TimeSlot[];
  // 予約
  createBooking: (booking: Omit<Booking, "id" | "bookingNumber" | "status" | "createdAt" | "updatedAt">) => Booking;
  confirmBooking: (bookingId: string, confirmedSlotId: string, assignedStaffId: string, meetLink?: string) => void;
  cancelBooking: (bookingId: string) => void;
  getBookingByNumber: (bookingNumber: string, studentEmail: string) => Booking | undefined;
  updateBookingSlots: (bookingId: string, newSlotIds: string[]) => void;
  createManualBooking: (params: {
    staffId: string;
    date: string;
    startTime: string;
    endTime: string;
    eventType: EventType;
    customEventName?: string;
    studentName: string;
    studentEmail?: string;
    meetLink?: string;
  }) => void;
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

// =============================================
// 予約番号生成
// =============================================

function generateBookingNumber(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "BK-";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// =============================================
// Provider
// =============================================

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const isDemoUser = user?.isDemoUser === true;

  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staffRoles, setStaffRoles] = useState<StaffRole[]>([]);

  const [loaded, setLoaded] = useState(false);

  // =============================================
  // キャッシュ付き一回読み込み（Firestoreリード節約）
  // localStorage に保存、5分間は再フェッチしない
  // =============================================
  const CACHE_TTL = 5 * 60 * 1000; // 5分

  function loadCache<T>(key: string): T[] | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw) as { data: T[]; ts: number };
      if (Date.now() - ts > CACHE_TTL) return null; // 期限切れ
      return data;
    } catch { return null; }
  }

  function saveCache<T>(key: string, data: T[]) {
    try {
      localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (isLoading) return;

    // デモユーザーはダミーデータを使用
    if (isDemoUser) {
      setStaffProfiles(DEMO_STAFF_PROFILES);
      setTimeSlots(DEMO_TIME_SLOTS);
      setBookings(DEMO_BOOKINGS);
      setStaffRoles(DEMO_STAFF_ROLES);
      setLoaded(true);
      return;
    }

    // キャッシュから復元できればFirestoreを読まない
    const cachedProfiles = loadCache<StaffProfile>("portal_staffProfiles");
    const cachedSlots    = loadCache<TimeSlot>("portal_timeSlots");
    const cachedBookings = loadCache<Booking>("portal_bookings");
    const cachedRoles    = loadCache<StaffRole>("portal_staffRoles");

    if (cachedProfiles && cachedSlots && cachedBookings && cachedRoles) {
      setStaffProfiles(cachedProfiles);
      setTimeSlots(cachedSlots);
      setBookings(cachedBookings);
      setStaffRoles(cachedRoles);
      setLoaded(true);
      return;
    }

    // Firestoreから一回だけ読み込む（getDocs）
    async function fetchAll() {
      const [profilesSnap, slotsSnap, bookingsSnap, rolesSnap] = await Promise.all([
        getDocs(collection(db, "staffProfiles")),
        getDocs(collection(db, "timeSlots")),
        getDocs(collection(db, "bookings")),
        getDocs(collection(db, "staffRoles")),
      ]);
      const profiles = profilesSnap.docs.map(d => ({ ...d.data(), id: d.id })) as StaffProfile[];
      const slots    = slotsSnap.docs.map(d => ({ ...d.data(), id: d.id })) as TimeSlot[];
      const bks      = bookingsSnap.docs.map(d => ({ ...d.data(), id: d.id })) as Booking[];
      const roles    = rolesSnap.docs.map(d => ({ ...d.data(), id: d.id })) as StaffRole[];

      saveCache("portal_staffProfiles", profiles);
      saveCache("portal_timeSlots", slots);
      saveCache("portal_bookings", bks);
      saveCache("portal_staffRoles", roles);

      setStaffProfiles(profiles);
      setTimeSlots(slots);
      setBookings(bks);
      setStaffRoles(roles);
      setLoaded(true);
    }

    fetchAll().catch(console.error);
  }, [isDemoUser, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // 書き込み後もキャッシュを常に最新に保つ（次回ロード時に使用）
  useEffect(() => { if (loaded && !isDemoUser) saveCache("portal_staffProfiles", staffProfiles); }, [staffProfiles, loaded, isDemoUser]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (loaded && !isDemoUser) saveCache("portal_timeSlots", timeSlots); }, [timeSlots, loaded, isDemoUser]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (loaded && !isDemoUser) saveCache("portal_bookings", bookings); }, [bookings, loaded, isDemoUser]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (loaded && !isDemoUser) saveCache("portal_staffRoles", staffRoles); }, [staffRoles, loaded, isDemoUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // =============================================
  // ロール管理
  // =============================================

  const addStaffRole = useCallback((name: string) => {
    if (isDemoUser) return;
    const id = crypto.randomUUID();
    const newRole: StaffRole = { id, name, order: staffRoles.length + 1 };
    setStaffRoles(prev => [...prev, newRole]);
    const { id: roleId, ...data } = newRole;
    setDoc(doc(db, "staffRoles", roleId), data);
  }, [isDemoUser, staffRoles.length]);

  const updateStaffRole = useCallback((id: string, updates: Partial<StaffRole>) => {
    if (isDemoUser) return;
    setStaffRoles(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    setDoc(doc(db, "staffRoles", id), updates, { merge: true });
  }, [isDemoUser]);

  const deleteStaffRole = useCallback((id: string) => {
    if (isDemoUser) return;
    setStaffRoles(prev => prev.filter(r => r.id !== id));
    deleteDoc(doc(db, "staffRoles", id));
    // スタッフプロフィールから削除されたロールIDを除去
    setStaffProfiles(prev => {
      const newProfiles = prev.map(p => ({
        ...p,
        roleIds: p.roleIds.filter(rid => rid !== id),
      }));
      newProfiles.forEach(p => {
        const { id: pId, ...data } = p;
        setDoc(doc(db, "staffProfiles", pId), data);
      });
      return newProfiles;
    });
  }, []);

  // =============================================
  // スタッフプロフィール
  // =============================================

  // undefinedをFirestoreに送らないようにクリーンアップ
  const cleanData = (obj: Record<string, unknown>) => {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) cleaned[key] = value;
    }
    return cleaned;
  };

  const addStaffProfile = useCallback((profile: Omit<StaffProfile, "id">) => {
    if (isDemoUser) return;
    const id = crypto.randomUUID();
    const data = { ...profile, id };
    setStaffProfiles(prev => [...prev, data as StaffProfile]);
    const { id: _id, ...rest } = data;
    setDoc(doc(db, "staffProfiles", id), cleanData(rest as Record<string, unknown>));
  }, [isDemoUser]);

  const updateStaffProfile = useCallback((id: string, updates: Partial<StaffProfile>) => {
    if (isDemoUser) return;
    setStaffProfiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    setDoc(doc(db, "staffProfiles", id), cleanData(updates as Record<string, unknown>), { merge: true });
  }, [isDemoUser]);

  const deleteStaffProfile = useCallback((id: string) => {
    if (isDemoUser) return;
    setStaffProfiles(prev => prev.filter(p => p.id !== id));
    deleteDoc(doc(db, "staffProfiles", id));
  }, [isDemoUser]);

  // =============================================
  // タイムスロット
  // =============================================

  const addTimeSlot = useCallback((slot: Omit<TimeSlot, "id">) => {
    if (isDemoUser) return;
    const id = crypto.randomUUID();
    const newSlot = { ...slot, id };
    setTimeSlots(prev => [...prev, newSlot]);
    const { id: _id, ...data } = newSlot;
    // JSON round-trip removes undefined fields (Firestore rejects undefined values)
    setDoc(doc(db, "timeSlots", id), JSON.parse(JSON.stringify(data)));
  }, [isDemoUser]);

  const addTimeSlots = useCallback((slots: Omit<TimeSlot, "id">[]) => {
    if (isDemoUser) return;
    const newSlots = slots.map(slot => ({ ...slot, id: crypto.randomUUID() }));
    setTimeSlots(prev => [...prev, ...newSlots]);
    const batch = writeBatch(db);
    newSlots.forEach(s => {
      const { id, ...data } = s;
      // JSON round-trip removes undefined fields (Firestore rejects undefined values)
      batch.set(doc(db, "timeSlots", id), JSON.parse(JSON.stringify(data)));
    });
    batch.commit();
  }, [isDemoUser]);

  const deleteTimeSlot = useCallback((id: string) => {
    if (isDemoUser) return;
    setTimeSlots(prev => prev.filter(s => s.id !== id));
    deleteDoc(doc(db, "timeSlots", id));
  }, [isDemoUser]);

  const getSlotsByStaff = useCallback((staffId: string) => {
    return timeSlots.filter(s => s.staffId === staffId);
  }, [timeSlots]);

  const getAvailableSlots = useCallback((eventType?: EventType) => {
    return timeSlots.filter(s => {
      if (s.isBooked) return false;
      if (eventType && s.eventType !== eventType) return false;
      return true;
    });
  }, [timeSlots]);

  // =============================================
  // 予約
  // =============================================

  const createBooking = useCallback((booking: Omit<Booking, "id" | "bookingNumber" | "status" | "createdAt" | "updatedAt">): Booking => {
    const now = new Date().toISOString();
    const newBooking: Booking = {
      ...booking,
      id: crypto.randomUUID(),
      bookingNumber: generateBookingNumber(),
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    if (!isDemoUser) {
      setBookings(prev => [...prev, newBooking]);
      const { id, ...data } = newBooking;
      setDoc(doc(db, "bookings", id), data);
    }
    return newBooking;
  }, [isDemoUser]);

  const confirmBooking = useCallback((bookingId: string, confirmedSlotId: string, assignedStaffId: string, meetLink?: string) => {
    if (isDemoUser) return;
    const now = new Date().toISOString();

    // 予約を確定
    setBookings(prev => {
      const newBookings = prev.map(b =>
        b.id === bookingId
          ? { ...b, confirmedSlotId, assignedStaffId, meetLink, status: "confirmed" as BookingStatus, updatedAt: now }
          : b
      );
      return newBookings;
    });
    setDoc(doc(db, "bookings", bookingId), { confirmedSlotId, assignedStaffId, meetLink, status: "confirmed" as BookingStatus, updatedAt: now }, { merge: true });

    // 対象スロットを予約済みに
    setTimeSlots(prev => prev.map(s => s.id === confirmedSlotId ? { ...s, isBooked: true, bookingId } : s));
    setDoc(doc(db, "timeSlots", confirmedSlotId), { isBooked: true, bookingId }, { merge: true });
  }, [isDemoUser]);

  const cancelBooking = useCallback((bookingId: string) => {
    if (isDemoUser) return;
    const now = new Date().toISOString();

    setBookings(prev => {
      const booking = prev.find(b => b.id === bookingId);
      const newBookings = prev.map(b =>
        b.id === bookingId ? { ...b, status: "cancelled" as BookingStatus, updatedAt: now } : b
      );
      if (booking?.confirmedSlotId) {
        setTimeSlots(prevSlots => prevSlots.map(s =>
          s.id === booking.confirmedSlotId ? { ...s, isBooked: false, bookingId: undefined } : s
        ));
        setDoc(doc(db, "timeSlots", booking.confirmedSlotId), { isBooked: false, bookingId: null }, { merge: true });
      }
      return newBookings;
    });
    setDoc(doc(db, "bookings", bookingId), { status: "cancelled" as BookingStatus, updatedAt: now }, { merge: true });
  }, [isDemoUser]);

  const getBookingByNumber = useCallback((bookingNumber: string, studentEmail: string): Booking | undefined => {
    return bookings.find(
      b => b.bookingNumber === bookingNumber && b.studentEmail === studentEmail
    );
  }, [bookings]);

  const updateBookingSlots = useCallback((bookingId: string, newSlotIds: string[]) => {
    if (isDemoUser) return;
    const now = new Date().toISOString();
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, selectedSlotIds: newSlotIds, updatedAt: now } : b));
    setDoc(doc(db, "bookings", bookingId), { selectedSlotIds: newSlotIds, updatedAt: now }, { merge: true });
  }, [isDemoUser]);

  const createManualBooking = useCallback(({ staffId, date, startTime, endTime, eventType, customEventName, studentName, studentEmail, meetLink }: {
    staffId: string;
    date: string;
    startTime: string;
    endTime: string;
    eventType: EventType;
    customEventName?: string;
    studentName: string;
    studentEmail?: string;
    meetLink?: string;
  }) => {
    if (isDemoUser) return;
    const now = new Date().toISOString();
    const slotId = crypto.randomUUID();
    const bookingId = crypto.randomUUID();
    const slot: TimeSlot = { id: slotId, staffId, date, startTime, endTime, eventType, customEventName, isBooked: true, bookingId };
    const booking: Booking = {
      id: bookingId,
      bookingNumber: generateBookingNumber(),
      studentName,
      studentEmail: studentEmail || "",
      selectedSlotIds: [slotId],
      confirmedSlotId: slotId,
      assignedStaffId: staffId,
      eventType,
      meetLink,
      status: "confirmed" as BookingStatus,
      createdAt: now,
      updatedAt: now,
    };
    setTimeSlots(prev => [...prev, slot]);
    setBookings(prev => [...prev, booking]);
    const { id: _sid, ...slotData } = slot;
    const { id: _bid, ...bookingData } = booking;
    setDoc(doc(db, "timeSlots", slotId), JSON.parse(JSON.stringify(slotData)));
    setDoc(doc(db, "bookings", bookingId), JSON.parse(JSON.stringify(bookingData)));
  }, [isDemoUser]);

  return (
    <ScheduleContext.Provider value={{
      staffProfiles, timeSlots, bookings, staffRoles,
      addStaffRole, updateStaffRole, deleteStaffRole,
      addStaffProfile, updateStaffProfile, deleteStaffProfile,
      addTimeSlot, addTimeSlots, deleteTimeSlot, getSlotsByStaff, getAvailableSlots,
      createBooking, confirmBooking, cancelBooking, getBookingByNumber, updateBookingSlots, createManualBooking,
    }}>
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule() {
  const context = useContext(ScheduleContext);
  if (context === undefined) {
    throw new Error("useSchedule must be used within a ScheduleProvider");
  }
  return context;
}
