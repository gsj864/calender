// 전역 변수
let currentDate = new Date();
let isAdminMode = false;
let selectedDate = null;
let events = [];
let eventToDelete = null;
const ADMIN_PASSWORD = 'gsj864';
let hasInitialized = false;

// DOM 요소
const currentMonthEl = document.getElementById('currentMonth');
const calendarGrid = document.getElementById('calendarGrid');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const modeToggleBtn = document.getElementById('modeToggle');
const addEventBtn = document.getElementById('addEventBtn');
const addEventWrapper = document.querySelector('.add-event-wrapper');
const eventModal = document.getElementById('eventModal');
const eventForm = document.getElementById('eventForm');
const closeModalBtn = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const deleteBtn = document.getElementById('deleteBtn');
const deleteModal = document.getElementById('deleteModal');
const closeDeleteModalBtn = document.getElementById('closeDeleteModal');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const eventListPanel = document.getElementById('eventListPanel');
const eventList = document.getElementById('eventList');
const selectedDateTitle = document.getElementById('selectedDateTitle');
const passwordModal = document.getElementById('passwordModal');
const passwordInput = document.getElementById('passwordInput');
const passwordError = document.getElementById('passwordError');
const confirmPasswordBtn = document.getElementById('confirmPasswordBtn');
const cancelPasswordBtn = document.getElementById('cancelPasswordBtn');
const closePasswordModalBtn = document.getElementById('closePasswordModal');

// 초기화
async function init() {
    // Prevent duplicate init (prevents duplicate event listeners -> month skips)
    if (hasInitialized) return;
    hasInitialized = true;

    await loadEvents();
    renderCalendar();
    setupEventListeners();
    updateModeUI();
}

// Firestore에서 일정 로드
async function loadEvents() {
    // Firebase가 로드될 때까지 대기
    let retries = 0;
    while (!window.db && retries < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
    }

    if (!window.db) {
        // Firebase가 로드되지 않았으면 LocalStorage 사용
        const stored = localStorage.getItem('calendarEvents');
        events = stored ? JSON.parse(stored) : [];
        return;
    }

    try {
        const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const eventsRef = collection(window.db, 'events');
        const snapshot = await getDocs(eventsRef);
        
        events = [];
        snapshot.forEach((doc) => {
            events.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Firestore에서 로드한 데이터를 LocalStorage에도 백업
        localStorage.setItem('calendarEvents', JSON.stringify(events));
    } catch (error) {
        console.error('일정 로드 실패:', error);
        // 에러 발생 시 LocalStorage에서 로드
        const stored = localStorage.getItem('calendarEvents');
        events = stored ? JSON.parse(stored) : [];
    }
}

// Firestore에 일정 저장
async function saveEvents() {
    if (!window.db) {
        // Firebase가 아직 로드되지 않았으면 LocalStorage 사용
        localStorage.setItem('calendarEvents', JSON.stringify(events));
        return;
    }

    try {
        const { collection, doc, setDoc, deleteDoc, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const eventsRef = collection(window.db, 'events');
        
        // 기존 Firestore의 모든 문서 가져오기
        const snapshot = await getDocs(eventsRef);
        const existingIds = new Set();
        snapshot.forEach((doc) => {
            existingIds.add(doc.id);
        });
        
        // 현재 events 배열의 ID들
        const currentIds = new Set(events.map(e => e.id));
        
        // 삭제된 일정 제거
        for (const id of existingIds) {
            if (!currentIds.has(id)) {
                const eventRef = doc(eventsRef, id);
                await deleteDoc(eventRef);
            }
        }
        
        // 모든 일정을 Firestore에 저장/업데이트
        for (const event of events) {
            const eventRef = doc(eventsRef, event.id);
            await setDoc(eventRef, {
                title: event.title,
                description: event.description || '',
                date: event.date,
                startTime: event.startTime || '',
                endTime: event.endTime || '',
                type: event.type,
                isPublic: event.isPublic
            }, { merge: true });
        }
        
        // LocalStorage에도 백업 저장
        localStorage.setItem('calendarEvents', JSON.stringify(events));
    } catch (error) {
        console.error('일정 저장 실패:', error);
        // 에러 발생 시 LocalStorage에 저장
        localStorage.setItem('calendarEvents', JSON.stringify(events));
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    prevMonthBtn.addEventListener('click', () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        // 날짜를 1일로 설정한 후 월 변경 (날짜 오버플로우 방지)
        currentDate = new Date(year, month - 1, 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        // 날짜를 1일로 설정한 후 월 변경 (날짜 오버플로우 방지)
        currentDate = new Date(year, month + 1, 1);
        renderCalendar();
    });

    modeToggleBtn.addEventListener('click', toggleAdminMode);
    addEventBtn.addEventListener('click', openAddEventModal);
    closeModalBtn.addEventListener('click', closeEventModal);
    cancelBtn.addEventListener('click', closeEventModal);
    eventForm.addEventListener('submit', handleEventSubmit);
    deleteBtn.addEventListener('click', openDeleteModal);
    closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    confirmDeleteBtn.addEventListener('click', confirmDelete);
    
    // 비밀번호 모달 이벤트
    confirmPasswordBtn.addEventListener('click', checkPassword);
    cancelPasswordBtn.addEventListener('click', closePasswordModal);
    closePasswordModalBtn.addEventListener('click', closePasswordModal);
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            checkPassword();
        }
    });

    // 모달 외부 클릭 시 닫기
    eventModal.addEventListener('click', (e) => {
        if (e.target === eventModal) {
            closeEventModal();
        }
    });

    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) {
            closeDeleteModal();
        }
    });

    passwordModal.addEventListener('click', (e) => {
        if (e.target === passwordModal) {
            closePasswordModal();
        }
    });
}

// 관리자 모드 토글
function toggleAdminMode() {
    if (isAdminMode) {
        // 관리자 모드에서 방문자 모드로 전환 (비밀번호 불필요)
        isAdminMode = false;
        updateModeUI();
        renderCalendar();
        if (selectedDate) {
            displayEventsForDate(selectedDate);
        }
    } else {
        // 방문자 모드에서 관리자 모드로 전환 (비밀번호 필요)
        openPasswordModal();
    }
}

// 모드 UI 업데이트
function updateModeUI() {
    if (isAdminMode) {
        modeToggleBtn.textContent = '관리자 모드';
        modeToggleBtn.classList.add('admin');
        addEventWrapper.style.display = 'block';
    } else {
        modeToggleBtn.textContent = '방문자 모드';
        modeToggleBtn.classList.remove('admin');
        addEventWrapper.style.display = 'none';
    }
}

// 캘린더 렌더링
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // 월 제목 업데이트
    currentMonthEl.textContent = `${year}년 ${month + 1}월`;

    // 그리드 초기화
    calendarGrid.innerHTML = '';

    // 첫 번째 날짜 (1일)
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // 주의 첫 날로 조정
    
    // 시작 날짜의 타임스탬프 저장
    const startTimestamp = startDate.getTime();

    // 6주 표시 (42일)
    for (let i = 0; i < 42; i++) {
        // 밀리초를 사용하여 정확한 날짜 계산
        const date = new Date(startTimestamp + i * 24 * 60 * 60 * 1000);

        const dayEl = createDayElement(date, month);
        calendarGrid.appendChild(dayEl);
    }
}

// 날짜 요소 생성
function createDayElement(date, currentMonth) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    
    // 날짜 정보를 data 속성에 저장
    const dateStr = formatDate(date);
    dayEl.setAttribute('data-date', dateStr);
    
    const dayNumber = date.getDate();
    const isOtherMonth = date.getMonth() !== currentMonth;
    const isToday = isSameDay(date, new Date());

    if (isOtherMonth) {
        dayEl.classList.add('other-month');
    }
    if (isToday) {
        dayEl.classList.add('today');
    }

    // 날짜 번호
    const dayNumberEl = document.createElement('div');
    dayNumberEl.className = 'day-number';
    dayNumberEl.textContent = dayNumber;
    dayEl.appendChild(dayNumberEl);

    // 일정 표시
    const dayEvents = getEventsForDate(dateStr);
    const visibleEvents = isAdminMode 
        ? dayEvents 
        : dayEvents.filter(event => event.isPublic);
    
    if (visibleEvents.length > 0) {
        // 일정이 있는 날짜에 클래스 추가
        dayEl.classList.add('has-events');
        
        // 일정 개수 표시 (하나의 배지로 통일)
        const eventCountEl = document.createElement('div');
        eventCountEl.className = 'event-count';
        eventCountEl.textContent = visibleEvents.length;
        dayEl.appendChild(eventCountEl);
    }

    // 날짜 클릭 이벤트
    dayEl.addEventListener('click', () => {
        selectDate(date);
    });

    return dayEl;
}

// 날짜 선택
function selectDate(date) {
    selectedDate = date;
    const dateStr = formatDate(date);
    
    // 모든 날짜 요소에서 selected 클래스 제거
    document.querySelectorAll('.calendar-day').forEach(el => {
        el.classList.remove('selected');
    });

    // 선택된 날짜에 selected 클래스 추가 (data-date 속성으로 정확하게 매칭)
    const targetDateStr = formatDate(date);
    document.querySelectorAll('.calendar-day').forEach(el => {
        if (el.getAttribute('data-date') === targetDateStr) {
            el.classList.add('selected');
        }
    });

    displayEventsForDate(date);
}

// 특정 날짜의 일정 표시
function displayEventsForDate(date) {
    const dateStr = formatDate(date);
    const dayEvents = getEventsForDate(dateStr);
    
    // 필터링: 관리자가 아니면 공개 일정만
    const visibleEvents = isAdminMode 
        ? dayEvents 
        : dayEvents.filter(event => event.isPublic);

    eventListPanel.classList.remove('hidden');
    
    // 날짜 제목
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    selectedDateTitle.textContent = `${month}월 ${day}일 (${weekday})`;

    // 일정 리스트
    eventList.innerHTML = '';

    if (visibleEvents.length === 0) {
        eventList.innerHTML = '<div class="empty-state"><p>등록된 일정이 없습니다.</p></div>';
        return;
    }

    visibleEvents.forEach(event => {
        const eventEl = createEventElement(event);
        eventList.appendChild(eventEl);
    });
}

// 일정 요소 생성
function createEventElement(event) {
    const eventEl = document.createElement('div');
    eventEl.className = 'event-item';

    const headerEl = document.createElement('div');
    headerEl.className = 'event-item-header';

    const titleEl = document.createElement('div');
    titleEl.className = 'event-item-title';
    titleEl.textContent = event.title;
    headerEl.appendChild(titleEl);

    eventEl.appendChild(headerEl);

    // 시간 정보
    if (event.startTime || event.endTime) {
        const timeEl = document.createElement('div');
        timeEl.className = 'event-item-time';
        let timeText = '';
        if (event.startTime && event.endTime) {
            timeText = `${event.startTime} - ${event.endTime}`;
        } else if (event.startTime) {
            timeText = `${event.startTime}부터`;
        } else if (event.endTime) {
            timeText = `${event.endTime}까지`;
        }
        timeEl.textContent = timeText;
        eventEl.appendChild(timeEl);
    }

    // 설명
    if (event.description) {
        const descEl = document.createElement('div');
        descEl.className = 'event-item-description';
        descEl.textContent = event.description;
        eventEl.appendChild(descEl);
    }

    // 메타 정보 (타입, 공개 여부)
    const metaEl = document.createElement('div');
    metaEl.className = 'event-item-meta';

    const typeBadge = document.createElement('span');
    typeBadge.className = 'event-badge badge-type';
    const typeNames = {
        availability: '면접 가능',
        project: '프로젝트',
        personal: '개인 일정'
    };
    typeBadge.textContent = typeNames[event.type] || event.type;
    metaEl.appendChild(typeBadge);

    const publicBadge = document.createElement('span');
    publicBadge.className = `event-badge ${event.isPublic ? 'badge-public' : 'badge-private'}`;
    publicBadge.textContent = event.isPublic ? '공개' : '비공개';
    metaEl.appendChild(publicBadge);

    eventEl.appendChild(metaEl);

    // 관리자 모드일 때 클릭 시 수정
    if (isAdminMode) {
        eventEl.style.cursor = 'pointer';
        eventEl.addEventListener('click', () => {
            openEditEventModal(event);
        });
    }

    return eventEl;
}

// 일정 추가 모달 열기
function openAddEventModal() {
    // 선택된 날짜가 있으면 그 날짜를, 없으면 오늘 날짜를 사용
    const dateToUse = selectedDate || new Date();
    document.getElementById('eventDate').value = formatDate(dateToUse);
    
    document.getElementById('modalTitle').textContent = '일정 추가';
    document.getElementById('eventForm').reset();
    document.getElementById('eventId').value = '';
    document.getElementById('deleteBtn').style.display = 'none';
    document.getElementById('eventIsPublic').checked = true;
    
    // 날짜 필드는 선택된 날짜로 설정
    document.getElementById('eventDate').value = formatDate(dateToUse);
    
    eventModal.classList.add('show');
}

// 일정 수정 모달 열기
function openEditEventModal(event) {
    document.getElementById('modalTitle').textContent = '일정 수정';
    document.getElementById('eventId').value = event.id;
    document.getElementById('eventTitle').value = event.title;
    document.getElementById('eventDescription').value = event.description || '';
    document.getElementById('eventDate').value = event.date;
    document.getElementById('eventStartTime').value = event.startTime || '';
    document.getElementById('eventEndTime').value = event.endTime || '';
    document.getElementById('eventType').value = event.type;
    document.getElementById('eventIsPublic').checked = event.isPublic;
    document.getElementById('deleteBtn').style.display = 'inline-block';
    
    eventModal.classList.add('show');
}

// 일정 모달 닫기
function closeEventModal() {
    eventModal.classList.remove('show');
    eventForm.reset();
}

// 일정 제출 처리
async function handleEventSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('eventId').value;
    const title = document.getElementById('eventTitle').value;
    const description = document.getElementById('eventDescription').value;
    const date = document.getElementById('eventDate').value;
    const startTime = document.getElementById('eventStartTime').value;
    const endTime = document.getElementById('eventEndTime').value;
    const type = document.getElementById('eventType').value;
    const isPublic = document.getElementById('eventIsPublic').checked;

    if (id) {
        // 수정
        const index = events.findIndex(e => e.id === id);
        if (index !== -1) {
            events[index] = {
                ...events[index],
                title,
                description,
                date,
                startTime,
                endTime,
                type,
                isPublic
            };
        }
    } else {
        // 추가
        const newEvent = {
            id: 'event_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            title,
            description,
            date,
            startTime,
            endTime,
            type,
            isPublic
        };
        events.push(newEvent);
    }

    await saveEvents();
    renderCalendar();
    
    if (selectedDate) {
        displayEventsForDate(selectedDate);
    }
    
    closeEventModal();
}

// 삭제 모달 열기
function openDeleteModal() {
    const id = document.getElementById('eventId').value;
    eventToDelete = id;
    deleteModal.classList.add('show');
    eventModal.classList.remove('show');
}

// 삭제 모달 닫기
function closeDeleteModal() {
    deleteModal.classList.remove('show');
    eventToDelete = null;
}

// 삭제 확인
async function confirmDelete() {
    if (eventToDelete) {
        // Firestore에서 삭제
        if (window.db) {
            try {
                const { doc, deleteDoc, collection } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                const eventRef = doc(collection(window.db, 'events'), eventToDelete);
                await deleteDoc(eventRef);
            } catch (error) {
                console.error('일정 삭제 실패:', error);
            }
        }
        
        // 로컬 배열에서 삭제
        events = events.filter(e => e.id !== eventToDelete);
        await saveEvents();
        renderCalendar();
        
        if (selectedDate) {
            displayEventsForDate(selectedDate);
        }
        
        closeDeleteModal();
    }
}

// 비밀번호 모달 열기
function openPasswordModal() {
    passwordInput.value = '';
    passwordError.style.display = 'none';
    passwordModal.classList.add('show');
    passwordInput.focus();
}

// 비밀번호 모달 닫기
function closePasswordModal() {
    passwordModal.classList.remove('show');
    passwordInput.value = '';
    passwordError.style.display = 'none';
}

// 비밀번호 확인
function checkPassword() {
    const inputPassword = passwordInput.value;
    
    if (inputPassword === ADMIN_PASSWORD) {
        isAdminMode = true;
        updateModeUI();
        renderCalendar();
        if (selectedDate) {
            displayEventsForDate(selectedDate);
        }
        closePasswordModal();
    } else {
        passwordError.style.display = 'block';
        passwordInput.value = '';
        passwordInput.focus();
    }
}

// 특정 날짜의 일정 가져오기
function getEventsForDate(dateStr) {
    return events.filter(event => event.date === dateStr);
}

// 날짜 포맷팅 (YYYY-MM-DD)
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 같은 날인지 확인
function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

// 초기화 실행 (1회만)
init();
