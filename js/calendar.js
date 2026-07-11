// ============================================
// CALENDAR MODULE
// ============================================

let currentDate = new Date();
let currentEvents = [];

// ============================================
// ADD EVENT
// ============================================

async function addEvent(title, date, type = 'reminder') {
    try {
        const user = await getCurrentUser();
        if (!user) return null;

        const event = {
            user_id: user.id,
            title: title,
            date: date,
            type: type
        };

        const { data, error } = await supabaseClient
            .from('events')
            .insert(event)
            .select()
            .single();

        if (error) throw error;

        await addXP(5);
        showToast('Event berhasil ditambahkan! 📅', 'success');
        return data;
    } catch (error) {
        console.error('Add event error:', error);
        showToast('Gagal menambahkan event', 'error');
        return null;
    }
}

// ============================================
// GET EVENTS
// ============================================

async function getEvents(startDate, endDate) {
    try {
        const user = await getCurrentUser();
        if (!user) return [];

        let query = supabaseClient
            .from('events')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: true });

        if (startDate) {
            query = query.gte('date', startDate);
        }
        if (endDate) {
            query = query.lte('date', endDate);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Also get partner's events
        const profile = await getUserProfile();
        if (profile?.partner_id) {
            const { data: partnerEvents, error: partnerError } = await supabaseClient
                .from('events')
                .select('*')
                .eq('user_id', profile.partner_id)
                .order('date', { ascending: true });

            if (!partnerError) {
                const combined = [...data, ...partnerEvents];
                combined.sort((a, b) => new Date(a.date) - new Date(b.date));
                currentEvents = combined;
                return combined;
            }
        }

        currentEvents = data;
        return data;
    } catch (error) {
        console.error('Get events error:', error);
        return [];
    }
}

// ============================================
// DELETE EVENT
// ============================================

async function deleteEvent(eventId) {
    try {
        const { error } = await supabaseClient
            .from('events')
            .delete()
            .eq('id', eventId);

        if (error) throw error;
        showToast('Event berhasil dihapus', 'success');
        return true;
    } catch (error) {
        console.error('Delete event error:', error);
        showToast('Gagal menghapus event', 'error');
        return false;
    }
}

// ============================================
// GENERATE CALENDAR
// ============================================

function generateCalendar(date, events) {
    const month = date.getMonth();
    const year = date.getFullYear();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    // Update header
    const header = document.getElementById('current-month');
    if (header) {
        header.textContent = `${monthNames[month]} ${year}`;
    }

    // Generate grid
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;

    grid.innerHTML = '';

    // Day names
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    dayNames.forEach(day => {
        const div = document.createElement('div');
        div.className = 'calendar-day';
        div.style.fontWeight = '600';
        div.style.fontSize = '0.7rem';
        div.style.color = 'var(--text-secondary)';
        div.textContent = day;
        grid.appendChild(div);
    });

    // Empty days
    for (let i = 0; i < firstDay; i++) {
        const div = document.createElement('div');
        div.className = 'calendar-day other-month';
        grid.appendChild(div);
    }

    // Days
    const eventDates = events ? events.map(e => e.date) : [];

    for (let day = 1; day <= daysInMonth; day++) {
        const div = document.createElement('div');
        div.className = 'calendar-day';

        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === today.toISOString().split('T')[0];
        const hasEvent = eventDates.includes(dateStr);

        if (isToday) div.classList.add('today');
        if (hasEvent) div.classList.add('has-event');

        div.textContent = day;
        div.dataset.date = dateStr;

        div.addEventListener('click', () => {
            showDayEvents(dateStr);
        });

        grid.appendChild(div);
    }
}

// ============================================
// SHOW DAY EVENTS
// ============================================

function showDayEvents(dateStr) {
    const events = currentEvents.filter(e => e.date === dateStr);
    const container = document.getElementById('events-list');
    if (!container) return;

    if (events.length === 0) {
        container.innerHTML = '<p class="empty-state">Tidak ada event pada hari ini</p>';
        return;
    }

    container.innerHTML = events.map(e => `
        <div class="event-item">
            <div>
                <span class="event-title">${e.title}</span>
                <span class="event-type">${e.type}</span>
            </div>
            <button class="delete-event-btn" data-id="${e.id}">🗑️</button>
        </div>
    `).join('');

    container.querySelectorAll('.delete-event-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (confirm('Hapus event ini?')) {
                await deleteEvent(id);
                const events = await getEvents();
                generateCalendar(currentDate, events);
                showDayEvents(dateStr);
            }
        });
    });
}

// ============================================
// INIT CALENDAR
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Check auth
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Load events
    const events = await getEvents();
    generateCalendar(currentDate, events);

    // Navigation buttons
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');

    if (prevBtn) {
        prevBtn.addEventListener('click', async () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            const events = await getEvents();
            generateCalendar(currentDate, events);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', async () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            const events = await getEvents();
            generateCalendar(currentDate, events);
        });
    }

    // Add event button
    const addBtn = document.getElementById('add-event-btn');
    const modal = document.getElementById('event-modal');
    const closeModalBtn = document.getElementById('close-event-modal');

    if (addBtn) {
        addBtn.addEventListener('click', () => {
            if (modal) {
                modal.classList.remove('hidden');
                const dateInput = document.getElementById('event-date');
                if (dateInput) {
                    dateInput.value = new Date().toISOString().split('T')[0];
                }
            }
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            if (modal) modal.classList.add('hidden');
        });
    }

    // Event form
    const eventForm = document.getElementById('event-form');
    if (eventForm) {
        eventForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('event-title').value;
            const date = document.getElementById('event-date').value;
            const type = document.getElementById('event-type').value;

            const result = await addEvent(title, date, type);
            if (result) {
                modal.classList.add('hidden');
                eventForm.reset();
                const events = await getEvents();
                generateCalendar(currentDate, events);
            }
        });
    }
});

// ============================================
// EXPORTS
// ============================================

window.addEvent = addEvent;
window.getEvents = getEvents;
window.deleteEvent = deleteEvent;
window.generateCalendar = generateCalendar;

console.log('✅ Calendar module loaded');
