// Firebase Firestore 일정 데이터 관리 (qna data.js 패턴)
import {
    collection,
    getDocs,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    addDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const CalendarDataManager = {
    get collectionName() {
        return 'events';
    },

    get db() {
        return window.firebaseDb;
    },

    // 일정 목록 가져오기
    async getEvents() {
        try {
            if (!this.db) return this.getEventsFromStorage();
            const snapshot = await getDocs(collection(this.db, this.collectionName));
            const list = [];
            snapshot.forEach((d) => {
                list.push({ id: d.id, ...d.data() });
            });
            localStorage.setItem('calendarEvents', JSON.stringify(list));
            return list;
        } catch (error) {
            console.error('일정 로드 오류:', error);
            return this.getEventsFromStorage();
        }
    },

    getEventsFromStorage() {
        try {
            const stored = localStorage.getItem('calendarEvents');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    },

    // 일정 추가
    async addEvent(event) {
        try {
            if (!this.db) {
                const id = 'event_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                const newEvent = { id, ...event };
                const list = this.getEventsFromStorage();
                list.push(newEvent);
                localStorage.setItem('calendarEvents', JSON.stringify(list));
                return newEvent;
            }
            const payload = {
                title: event.title,
                description: event.description || '',
                date: event.date,
                startTime: event.startTime || '',
                endTime: event.endTime || '',
                type: event.type,
                isPublic: event.isPublic
            };
            const docRef = await addDoc(collection(this.db, this.collectionName), payload);
            const newEvent = { id: docRef.id, ...payload };
            const list = this.getEventsFromStorage();
            list.push(newEvent);
            localStorage.setItem('calendarEvents', JSON.stringify(list));
            return newEvent;
        } catch (error) {
            console.error('일정 추가 오류:', error);
            throw error;
        }
    },

    // 일정 수정
    async updateEvent(id, updates) {
        const allowed = ['title', 'description', 'date', 'startTime', 'endTime', 'type', 'isPublic'];
        const payload = {};
        allowed.forEach((k) => {
            if (updates[k] !== undefined) payload[k] = updates[k];
        });
        try {
            if (!this.db) {
                const list = this.getEventsFromStorage();
                const idx = list.findIndex((e) => e.id === id);
                if (idx === -1) return null;
                list[idx] = { ...list[idx], ...payload };
                localStorage.setItem('calendarEvents', JSON.stringify(list));
                return list[idx];
            }
            const ref = doc(this.db, this.collectionName, id);
            await setDoc(ref, payload, { merge: true });
            const list = this.getEventsFromStorage();
            const idx = list.findIndex((e) => e.id === id);
            if (idx !== -1) {
                list[idx] = { ...list[idx], ...payload };
                localStorage.setItem('calendarEvents', JSON.stringify(list));
            }
            return list[idx] || null;
        } catch (error) {
            console.error('일정 수정 오류:', error);
            return null;
        }
    },

    // 일정 삭제
    async deleteEvent(id) {
        try {
            if (!this.db) {
                const list = this.getEventsFromStorage().filter((e) => e.id !== id);
                localStorage.setItem('calendarEvents', JSON.stringify(list));
                return true;
            }
            const ref = doc(this.db, this.collectionName, id);
            await deleteDoc(ref);
            const list = this.getEventsFromStorage().filter((e) => e.id !== id);
            localStorage.setItem('calendarEvents', JSON.stringify(list));
            return true;
        } catch (error) {
            console.error('일정 삭제 오류:', error);
            return false;
        }
    }
};

window.CalendarDataManager = CalendarDataManager;
