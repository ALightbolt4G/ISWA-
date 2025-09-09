// إعداد Supabase
const SUPABASE_URL = 'https://kqpxoplowdyfhzstkvwk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxcHhvcGxvd2R5Zmh6c3RrdndrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MTU3OTYsImV4cCI6MjA3Mjk5MTc5Nn0.DJuCG-Ou0QAi8FhR-3rYbr539xLO8MOvMrHwDvg6yZI';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// حالة التطبيق
let isDarkMode = false;
let items = [];
let transactions = [];

// تهيئة التطبيق
document.addEventListener('DOMContentLoaded', async function() {
    await initApp();
    setupEventListeners();
});

// تهيئة التطبيق
async function initApp() {
    try {
        updateStatus('جاري تحميل البيانات...');
        
        // تحميل العناصر والمعاملات
        await loadItems();
        await loadTransactions();
        
        // تحديث واجهة المستخدم
        refreshItemsList();
        setupDefaultDates();
        
        updateStatus('جاهز - متصل بقاعدة البيانات');
        
    } catch (error) {
        console.error('Error initializing app:', error);
        updateStatus('خطأ في تحميل البيانات');
    }
}

// تحميل العناصر
async function loadItems() {
    const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('name');
    
    if (error) throw error;
    items = data || [];
}

// تحميل المعاملات
async function loadTransactions() {
    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('timestamp', { ascending: false });
    
    if (error) throw error;
    transactions = data || [];
}

// إضافة معاملة جديدة
async function addTransaction() {
    const itemName = document.getElementById('itemName').value.trim();
    const type = document.getElementById('transactionType').value;
    const quantity = parseInt(document.getElementById('quantity').value);
    
    if (!itemName) {
        alert('يرجى إدخال اسم الصنف');
        return;
    }
    
    if (quantity <= 0) {
        alert('يرجى إدخال كمية صحيحة');
        return;
    }
    
    try {
        updateStatus('جاري إضافة المعاملة...');
        
        // إضافة المعاملة
        const { data, error } = await supabase
            .from('transactions')
            .insert([
                {
                    item_name: itemName,
                    type: type,
                    quantity: quantity,
                    timestamp: new Date().toISOString()
                }
            ]);
        
        if (error) throw error;
        
        // إضافة الصنف إذا كان جديداً
        if (!items.some(item => item.name === itemName)) {
            const { error: itemError } = await supabase
                .from('items')
                .insert([{ name: itemName }]);
            
            if (!itemError) {
                items.push({ name: itemName });
            }
        }
        
        // إعادة تحميل البيانات
        await loadTransactions();
        refreshItemsList();
        
        // تحديث التقرير
        generateReport();
        
        // مسح الحقول
        document.getElementById('itemName').value = '';
        document.getElementById('quantity').value = '1';
        
        updateStatus('تمت إضافة المعاملة بنجاح');
        
        // إشعار
        showNotification(`تمت إضافة ${type === 'supply' ? 'توريد' : 'استهلاك'} للصنف ${itemName}`);
        
    } catch (error) {
        console.error('Error adding transaction:', error);
        updateStatus('خطأ في إضافة المعاملة');
    }
}

// توليد التقرير
function generateReport() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
        alert('يرجى تحديد تاريخ البداية والنهاية');
        return;
    }
    
    const reportData = {};
    let totalSupply = 0;
    let totalConsume = 0;
    
    // معالجة البيانات
    transactions.forEach(transaction => {
        const transactionDate = transaction.timestamp.split('T')[0];
        
        if (transactionDate >= startDate && transactionDate <= endDate) {
            const itemName = transaction.item_name;
            
            if (!reportData[itemName]) {
                reportData[itemName] = { supply: 0, consume: 0 };
            }
            
            if (transaction.type === 'supply') {
                reportData[itemName].supply += transaction.quantity;
                totalSupply += transaction.quantity;
            } else {
                reportData[itemName].consume += transaction.quantity;
                totalConsume += transaction.quantity;
            }
        }
    });
    
    // عرض التقرير
    displayReport(reportData, totalSupply, totalConsume, startDate, endDate);
}

// عرض التقرير
function displayReport(reportData, totalSupply, totalConsume, startDate, endDate) {
    const tableBody = document.getElementById('reportTableBody');
    const reportSummary = document.getElementById('reportSummary');
    
    // مسح المحتوى السابق
    tableBody.innerHTML = '';
    
    // إضافة البيانات
    Object.keys(reportData).forEach(itemName => {
        const data = reportData[itemName];
        const balance = data.supply - data.consume;
        
        const row = tableBody.insertRow();
        
        // إضافة خلايا الصف
        row.insertCell(0).textContent = itemName;
        row.insertCell(1).textContent = data.supply;
        row.insertCell(2).textContent = data.consume;
        
        const balanceCell = row.insertCell(3);
        balanceCell.textContent = balance;
        
        // تلوين الخلايا حسب الرصيد
        if (balance < 0) {
            balanceCell.classList.add('balance-negative');
        } else if (balance < 10) {
            balanceCell.classList.add('balance-low');
        }
    });
    
    // إضافة صف المجموع
    if (Object.keys(reportData).length > 0) {
        const totalRow = tableBody.insertRow();
        totalRow.classList.add('total-row');
        
        totalRow.insertCell(0).textContent = 'المجموع';
        totalRow.insertCell(1).textContent = totalSupply;
        totalRow.insertCell(2).textContent = totalConsume;
        totalRow.insertCell(3).textContent = totalSupply - totalConsume;
        
        // تنسيق صف المجموع
        totalRow.cells[0].style.fontWeight = 'bold';
        totalRow.cells[1].style.fontWeight = 'bold';
        totalRow.cells[2].style.fontWeight = 'bold';
        totalRow.cells[3].style.fontWeight = 'bold';
        totalRow.style.backgroundColor = '#e3f2fd';
    }
    
    // تحديث ملخص التقرير
    reportSummary.innerHTML = `
        <h3>تقرير المخزون من ${startDate} إلى ${endDate}</h3>
        <p>عدد الأصناف: ${Object.keys(reportData).length} | 
           إجمالي التوريد: ${totalSupply} | 
           إجمالي الاستهلاك: ${totalConsume}</p>
    `;
}

// تحديث قائمة العناصر
function refreshItemsList() {
    const itemsList = document.getElementById('itemsList');
    itemsList.innerHTML = '';
    
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item.name;
        itemsList.appendChild(option);
    });
}

// إعداد التواريخ الافتراضية
function setupDefaultDates() {
    const today = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(today.getDate() - 7);
    
    document.getElementById('startDate').value = oneWeekAgo.toISOString().split('T')[0];
    document.getElementById('endDate').value = today.toISOString().split('T')[0];
}

// تحديث حالة النظام
function updateStatus(message) {
    document.getElementById('statusText').textContent = message;
}

// إظهار الإشعار
function showNotification(message) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('نظام مخزون رسلان', {
            body: message,
            icon: '/favicon.ico'
        });
    }
}

// إعداد مستمعي الأحداث
function setupEventListeners() {
    document.getElementById('addTransactionBtn').addEventListener('click', addTransaction);
    document.getElementById('generateReportBtn').addEventListener('click', generateReport);
    document.getElementById('darkModeBtn').addEventListener('click', toggleDarkMode);
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('importBtn').addEventListener('click', importData);
    
    // توليد التقرير تلقائياً عند التحميل
    generateReport();
}

// تبديل الوضع الليلي
function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode', isDarkMode);
    
    const button = document.getElementById('darkModeBtn');
    button.textContent = isDarkMode ? 'الوضع النهاري' : 'الوضع الليلي';
    button.style.background = isDarkMode ? '#f39c12' : '#34495e';
    button.style.color = 'white';
    
    // تطبيق الألوان على جميع العناصر
    applyDarkModeStyles(isDarkMode);
    
    // حفظ الإعدادات
    localStorage.setItem('darkMode', isDarkMode);
}

// تطبيق أنماط الوضع الليلي على جميع العناصر
function applyDarkModeStyles(isDark) {
    const elementsToStyle = [
        '.container',
        '.transaction-section',
        '.report-section',
        '.header',
        '.status-bar',
        'table',
        'th',
        'tr',
        'td'
    ];
    
    const styles = document.getElementById('dark-mode-styles');
    if (!styles) {
        const styleElement = document.createElement('style');
        styleElement.id = 'dark-mode-styles';
        document.head.appendChild(styleElement);
    }
    
    if (isDark) {
        document.getElementById('dark-mode-styles').textContent = `
            .dark-mode .container {
                background: #2c3e50 !important;
                color: #ecf0f1 !important;
            }
            .dark-mode .transaction-section,
            .dark-mode .report-section {
                background: #34495e !important;
                color: #ecf0f1 !important;
                border-color: #4a6278 !important;
            }
            .dark-mode .header {
                background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%) !important;
            }
            .dark-mode .status-bar {
                background: #2c3e50 !important;
                color: #ecf0f1 !important;
            }
            .dark-mode table {
                background: #34495e !important;
                color: #ecf0f1 !important;
                border-color: #4a6278 !important;
            }
            .dark-mode th {
                background: #2c3e50 !important;
                color: #ecf0f1 !important;
                border-color: #4a6278 !important;
            }
            .dark-mode tr {
                background: #3b4f63 !important;
                color: #ecf0f1 !important;
                border-color: #4a6278 !important;
            }
            .dark-mode tr:nth-child(even) {
                background: #34495e !important;
            }
            .dark-mode tr:hover {
                background: #4a6278 !important;
            }
            .dark-mode td {
                background: inherit !important;
                color: inherit !important;
                border-color: #4a6278 !important;
            }
            .dark-mode .form-group input,
            .dark-mode .form-group select,
            .dark-mode .filter-group input {
                background: #2c3e50 !important;
                color: #ecf0f1 !important;
                border-color: #4a6278 !important;
            }
            .dark-mode .report-summary {
                background: #3b4f63 !important;
                color: #ecf0f1 !important;
                border-color: #3498db !important;
            }
        `;
    } else {
        document.getElementById('dark-mode-styles').textContent = '';
    }
}

// تحميل الإعدادات
function loadSettings() {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
        isDarkMode = true;
        document.body.classList.add('dark-mode');
        document.getElementById('darkModeBtn').textContent = 'الوضع النهاري';
        document.getElementById('darkModeBtn').style.background = '#f39c12';
        document.getElementById('darkModeBtn').style.color = 'white';
        applyDarkModeStyles(true);
    }
}

// تصدير البيانات
async function exportData() {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('*');
        
        if (error) throw error;
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'inventory_export.json';
        a.click();
        
        URL.revokeObjectURL(url);
        updateStatus('تم تصدير البيانات بنجاح');
        
    } catch (error) {
        console.error('Error exporting data:', error);
        updateStatus('خطأ في تصدير البيانات');
    }
}

// استيراد البيانات
async function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const content = await file.text();
            const data = JSON.parse(content);
            
            updateStatus('جاري استيراد البيانات...');
            
            const { error } = await supabase
                .from('transactions')
                .insert(data);
            
            if (error) throw error;
            
            // إعادة تحميل البيانات
            await loadTransactions();
            generateReport();
            
            updateStatus('تم استيراد البيانات بنجاح');
            showNotification('تم استيراد البيانات بنجاح');
            
        } catch (error) {
            console.error('Error importing data:', error);
            updateStatus('خطأ في استيراد البيانات');
        }
    };
    
    input.click();
}

// تحميل الإعدادات المحفوظة
function loadSettings() {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
        isDarkMode = true;
        document.body.classList.add('dark-mode');
        document.getElementById('darkModeBtn').textContent = 'الوضع النهاري';
    }
}

// طلب الإذن للإشعارات
if ('Notification' in window) {
    Notification.requestPermission();
}

// تحميل الإعدادات عند البدء
loadSettings();

// تحديث استخدام الذاكرة (محاكاة)
setInterval(() => {
    const memoryUsage = Math.random() * 10 + 5;
    document.getElementById('memoryUsage').textContent = `الذاكرة: ${memoryUsage.toFixed(1)} MB`;
}, 5000);