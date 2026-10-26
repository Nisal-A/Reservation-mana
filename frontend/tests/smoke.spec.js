import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Helper to assert no horizontal scroll on page
async function assertNoHorizontalScroll(page, label) {
  await page.waitForTimeout(400); // Allow render to settle
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    scrollWidth,
    `Horizontal scroll detected on [${label}]: document.documentElement.scrollWidth (${scrollWidth}) > window.innerWidth (${innerWidth})`
  ).toBeLessThanOrEqual(innerWidth);
}

// Helper to save screenshot
async function takeScreenshot(page, testInfo, filename) {
  const dir = path.join(process.cwd(), 'screenshots', testInfo.project.name);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  await page.screenshot({ path: path.join(dir, `${filename}.png`), fullPage: false });
}

// Format date helper YYYY-MM-DD
function offsetDateString(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

test.describe('Frontend Smoke Tests', () => {

  // ───────────────────────────────────────────────────────────────────────────
  // 1. CUSTOMER FLOW
  // ───────────────────────────────────────────────────────────────────────────
  test('Customer Flow: search dates, select room, register, book, view confirmation, find in bookings, cancel', async ({ page }, testInfo) => {
    // Dates: 30 days in future to be safely beyond cancellation deadline
    const checkInDate = offsetDateString(30);
    const checkOutDate = offsetDateString(33);
    const uniqueId = Date.now().toString().slice(-6);
    const guestUser = `guest_${uniqueId}`;
    const guestEmail = `guest_${uniqueId}@luxestay.test`;

    // 1. Open /
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await assertNoHorizontalScroll(page, 'Home Page (/)');
    await takeScreenshot(page, testInfo, '01_customer_home');

    // 2. Search dates in SearchBar
    await page.fill('#search-check-in', checkInDate);
    await page.fill('#search-check-out', checkOutDate);
    await page.click('#search-availability-btn');

    // 3. Rooms page
    await page.waitForURL(/\/rooms/);
    await page.waitForLoadState('networkidle');
    await assertNoHorizontalScroll(page, 'Rooms Page (/rooms)');
    await takeScreenshot(page, testInfo, '02_customer_rooms');

    // 4. Open first available room details
    const roomCard = page.locator('.room-card-ui').first();
    await expect(roomCard).toBeVisible({ timeout: 10000 });
    const selectBtn = roomCard.locator('.room-action-btn').first();
    await selectBtn.click();

    // 5. Room Details page
    await page.waitForURL(/\/rooms\/\d+/);
    await page.waitForLoadState('networkidle');
    await assertNoHorizontalScroll(page, 'Room Details Page');
    await takeScreenshot(page, testInfo, '03_customer_room_details');

    // 6. Click Reserve button (redirects to /login?next=...)
    const reserveBtn = page.locator('#reserve-suite-btn');
    await expect(reserveBtn).toBeEnabled({ timeout: 10000 });
    await reserveBtn.click();

    // 7. Login page (unauthenticated redirect)
    await page.waitForURL(/\/login/);
    await assertNoHorizontalScroll(page, 'Login Page');
    await takeScreenshot(page, testInfo, '04_customer_login');

    // 8. Navigate to Register page preserving next param
    const currentUrl = new URL(page.url());
    const nextParam = currentUrl.searchParams.get('next');
    await page.goto(`/register?next=${encodeURIComponent(nextParam || '')}`);
    await page.waitForLoadState('networkidle');
    await assertNoHorizontalScroll(page, 'Register Page');
    await takeScreenshot(page, testInfo, '05_customer_register');

    // Fill registration
    await page.fill('#register-name', 'Smoke Test Guest');
    await page.fill('#register-email', guestEmail);
    await page.fill('#register-phone', '+94770001122');
    await page.fill('#register-username', guestUser);
    await page.fill('#register-password', 'Password123');
    await page.fill('#register-confirm-password', 'Password123');
    await page.click('button[type="submit"]');

    // 9. Checkout page
    await page.waitForURL(/\/checkout/);
    await page.waitForLoadState('networkidle');
    await assertNoHorizontalScroll(page, 'Checkout Step 1');
    await takeScreenshot(page, testInfo, '06_customer_checkout_step1');

    // Step 1: Continue to Guest Details
    const step1Btn = page.locator('#checkout-step1-continue');
    await expect(step1Btn).toBeEnabled({ timeout: 10000 });
    await step1Btn.click();

    // Step 2: Guest details -> Continue to Review
    await page.waitForSelector('#checkout-step2-continue', { timeout: 10000 });
    await assertNoHorizontalScroll(page, 'Checkout Step 2');
    await page.click('#checkout-step2-continue');

    // Step 3: Review and Confirm
    await page.waitForSelector('#confirm-booking-btn', { timeout: 10000 });
    await assertNoHorizontalScroll(page, 'Checkout Step 3');
    await page.check('#accept-policy-checkbox');
    await expect(page.locator('#confirm-booking-btn')).toBeEnabled();
    await page.click('#confirm-booking-btn');

    // 10. Booking confirmation page
    await page.waitForURL(/\/booking\/LS-\d{4}-\d{6}\/confirmation/);
    await page.waitForLoadState('networkidle');
    await assertNoHorizontalScroll(page, 'Booking Confirmation');
    await takeScreenshot(page, testInfo, '07_customer_confirmation');

    const refLocator = page.locator('.confirmation-ref-code');
    await expect(refLocator).toBeVisible();
    const bookingRef = (await refLocator.textContent())?.trim();
    expect(bookingRef).toMatch(/^LS-\d{4}-\d{6}$/);

    // 11. Find in My Bookings
    await page.click('#view-my-bookings-btn');
    await page.waitForURL(/\/account\/bookings/);
    await page.waitForLoadState('networkidle');
    await assertNoHorizontalScroll(page, 'My Bookings List');
    await takeScreenshot(page, testInfo, '08_customer_my_bookings');

    const bookingCardInList = page.locator('.my-booking-card', { hasText: bookingRef });
    await expect(bookingCardInList).toBeVisible({ timeout: 10000 });

    // 12. Cancel booking
    await bookingCardInList.locator('button:has-text("View details")').click();
    await page.waitForURL(new RegExp(`/account/bookings/${bookingRef}`));
    await page.waitForLoadState('networkidle');
    await assertNoHorizontalScroll(page, 'Booking Details Page');
    await takeScreenshot(page, testInfo, '09_customer_booking_details');

    const cancelBtn = page.locator('button:has-text("Cancel Booking")');
    await expect(cancelBtn).toBeVisible({ timeout: 10000 });
    await cancelBtn.click();

    // Confirm cancel modal
    const confirmCancelBtn = page.locator('button:has-text("Yes, Cancel Booking")');
    await expect(confirmCancelBtn).toBeVisible({ timeout: 5000 });
    await confirmCancelBtn.click();

    // Verify cancellation
    await expect(page.locator('text=This reservation was cancelled')).toBeVisible({ timeout: 10000 });
    await assertNoHorizontalScroll(page, 'Cancelled Booking Details');
    await takeScreenshot(page, testInfo, '10_customer_cancelled');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. RECEPTION FLOW
  // ───────────────────────────────────────────────────────────────────────────
  test('Reception Flow: log in, confirm booking, check in, pay, check out', async ({ page, request }, testInfo) => {
    // 1. Create a reservation for today via API so it is eligible for check-in today
    const todayStr = offsetDateString(0);
    const tomorrowStr = offsetDateString(1);

    // Get an available room from public API
    const roomsRes = await request.get(`http://localhost:3001/api/public/rooms?check_in=${todayStr}&check_out=${tomorrowStr}&limit=10`);
    const roomsJson = await roomsRes.json();
    const testRoom = Array.isArray(roomsJson) ? roomsJson[0] : (roomsJson.data?.[0] || roomsJson.rooms?.[0]);
    expect(testRoom).toBeDefined();

    // Register a fresh customer for this reception test
    const uniqueCust = `recept_guest_${Date.now()}`;
    const testIp = `10.50.${Date.now() % 250}.1`;

    await request.post('http://localhost:3001/api/auth/register', {
      headers: { 'x-test-ip': testIp },
      data: {
        username: uniqueCust,
        password: 'Password123',
        name: 'Reception Lifecycle Guest',
        email: `${uniqueCust}@luxestay.test`,
        phone: '+94770005566',
      },
    });

    const loginRes = await request.post('http://localhost:3001/api/auth/login', {
      headers: { 'x-test-ip': testIp },
      data: {
        username: uniqueCust,
        password: 'Password123',
      },
    });
    expect(loginRes.status()).toBe(200);
    const { token: custToken } = await loginRes.json();

    // Create reservation as pending
    const bookRes = await request.post('http://localhost:3001/api/reservations', {
      headers: {
        Authorization: `Bearer ${custToken}`,
        'x-test-ip': testIp,
      },
      data: {
        room_id: testRoom.room_id,
        check_in_date: todayStr,
        check_out_date: tomorrowStr,
        guests: 1,
      },
    });
    expect(bookRes.status()).toBe(201);
    const bookJson = await bookRes.json();
    const booking_ref = bookJson.booking_ref || bookJson.reservation?.booking_ref;
    expect(booking_ref).toBeDefined();

    // 2. Log in as reception
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await assertNoHorizontalScroll(page, 'Reception Login Page');

    await page.fill('#login-username', 'reception');
    await page.fill('#login-password', 'password');
    await page.click('button[type="submit"]');

    // Lands on /reception
    await page.waitForURL(/\/reception/);
    await page.waitForLoadState('networkidle');
    await assertNoHorizontalScroll(page, 'Reception Dashboard');
    await takeScreenshot(page, testInfo, '11_reception_dashboard');

    // 3. Open Reception Reservations
    await page.goto(`/reception/reservations?q=${booking_ref}`);
    await page.waitForLoadState('networkidle');
    await assertNoHorizontalScroll(page, 'Reception Reservations Table');
    await takeScreenshot(page, testInfo, '12_reception_reservations');

    // Click row to open ReservationDetailPanel drawer
    const row = page.locator('table.data-table-ui tbody tr', { hasText: booking_ref });
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click();

    const drawer = page.locator('.reservation-drawer-panel');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await assertNoHorizontalScroll(page, 'Reservation Detail Drawer');
    await takeScreenshot(page, testInfo, '13_reception_drawer_pending');

    // 4. Confirm Booking
    const confirmBtn = drawer.locator('button:has-text("Confirm Booking")');
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();
    await expect(drawer.locator('text=Confirmed').first()).toBeVisible({ timeout: 10000 });

    // 5. Check In (allowed on today's date)
    const checkInBtn = drawer.locator('button:has-text("Check In")');
    await expect(checkInBtn).toBeEnabled({ timeout: 5000 });
    await checkInBtn.click();
    await expect(drawer.locator('text=Checked In').first()).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, testInfo, '14_reception_checked_in');

    // 6. Pay (Record Payment)
    const recordPaymentBtn = drawer.locator('button:has-text("Record Payment")');
    await expect(recordPaymentBtn).toBeVisible({ timeout: 5000 });
    await recordPaymentBtn.click();

    // Payment modal
    const modal = page.locator('.modal-ui-overlay');
    await expect(modal).toBeVisible({ timeout: 5000 });
    const savePayBtn = modal.locator('button:has-text("Save Payment")');
    await savePayBtn.click();
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Payment status should now be Paid
    await expect(drawer.locator('text=Paid').first()).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, testInfo, '15_reception_paid');

    // 7. Check Out
    const checkOutBtn = drawer.locator('button:has-text("Check Out")');
    await expect(checkOutBtn).toBeVisible({ timeout: 5000 });
    await checkOutBtn.click();
    await expect(drawer.locator('text=Checked Out').first()).toBeVisible({ timeout: 10000 });
    await assertNoHorizontalScroll(page, 'Checked Out State');
    await takeScreenshot(page, testInfo, '16_reception_checked_out');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. ADMIN FLOW
  // ───────────────────────────────────────────────────────────────────────────
  test('Admin Flow: log in, open dashboard and each report tab, export CSV', async ({ page }, testInfo) => {
    // 1. Log in as admin
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await assertNoHorizontalScroll(page, 'Admin Login Page');

    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin');
    await page.click('button[type="submit"]');

    // Lands on /admin
    await page.waitForURL(/\/admin/);
    await page.waitForLoadState('networkidle');
    await assertNoHorizontalScroll(page, 'Admin Dashboard (/admin)');
    await takeScreenshot(page, testInfo, '17_admin_dashboard');

    // 2. Open /admin/reports and verify each report tab
    const reportTabs = [
      { id: 'revenue', label: 'Revenue' },
      { id: 'reservations', label: 'Reservations' },
      { id: 'occupancy', label: 'Occupancy & Rooms' },
      { id: 'customers', label: 'Customers' },
      { id: 'operations', label: 'Operations' },
    ];

    for (const tab of reportTabs) {
      await page.goto(`/admin/reports?tab=${tab.id}`);
      await page.waitForLoadState('networkidle');
      // Verify tab button exists in tabs nav bar
      const tabBtn = page.locator(`.tabs-nav-bar button`, { hasText: tab.label });
      await expect(tabBtn).toBeVisible({ timeout: 10000 });
      await assertNoHorizontalScroll(page, `Report Tab: ${tab.label}`);
      await takeScreenshot(page, testInfo, `18_admin_report_${tab.id}`);
    }

    // 3. Export CSV from Reservations tab
    await page.goto('/admin/reports?tab=reservations');
    await page.waitForLoadState('networkidle');

    // Click Export Menu button
    const exportBtn = page.locator('.export-menu-container button').first();
    await exportBtn.scrollIntoViewIfNeeded();
    await expect(exportBtn).toBeVisible({ timeout: 10000 });
    await exportBtn.click();

    // Click CSV File (.csv) option and wait for download
    const csvOption = page.locator('button.export-option-btn:has-text("CSV File")');
    await expect(csvOption).toBeVisible({ timeout: 5000 });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      csvOption.click(),
    ]);

    const downloadedFilename = download.suggestedFilename();
    expect(downloadedFilename).toMatch(/\.csv$/i);

    await assertNoHorizontalScroll(page, 'Admin Report After CSV Export');
    await takeScreenshot(page, testInfo, '19_admin_csv_exported');
  });

});
