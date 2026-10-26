import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  User,
  Phone,
  Mail,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  CreditCard,
  RotateCcw,
  LogIn,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { formatLKR, formatDate, nightsBetween, todayISO } from '../../utils/format';
import {
  Stepper,
  Button,
  FormField,
  Input,
  Textarea,
  GoldDivider,
  Eyebrow,
  Skeleton,
  ReservationDetailPanel,
} from '../../components/UI';

const STEPS = ['Stay & Room', 'Guest Details', 'Review & Confirm'];

export default function CreateReservation() {
  const navigate = useNavigate();
  const todayStr = todayISO();

  // Wizard step (0: stay/room, 1: guest, 2: review, 3: success)
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1: Dates & Guests
  const [dates, setDates] = useState({
    check_in_date: todayStr,
    check_out_date: '',
    guests: 1,
  });
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);

  // Step 2: Guest Details
  const [guestMode, setGuestMode] = useState('existing'); // 'existing' | 'new'
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [newGuest, setNewGuest] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [remark, setRemark] = useState('');

  // Step 3: Submitting
  const [submitting, setSubmitting] = useState(false);
  const [createdBooking, setCreatedBooking] = useState(null);

  // Success actions: detail drawer
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  // Fetch bookable rooms when dates/guests change
  const fetchBookableRooms = useCallback(async () => {
    if (!dates.check_in_date || !dates.check_out_date) return;
    if (dates.check_in_date >= dates.check_out_date) {
      toast.error('Check-out date must be strictly after check-in date.');
      return;
    }

    setLoadingRooms(true);
    setSelectedRoom(null);
    try {
      const res = await api.get('/rooms', {
        params: {
          check_in: dates.check_in_date,
          check_out: dates.check_out_date,
          guests: dates.guests,
        },
      });
      const roomList = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setRooms(roomList);
      if (roomList.length === 0) {
        toast.error('No rooms available for the selected dates and guest count.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to search available rooms.');
      setRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  }, [dates]);

  // Debounced customer search typeahead
  const searchTimeoutRef = useRef(null);
  useEffect(() => {
    if (guestMode !== 'existing' || !customerSearch.trim()) {
      setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      setSearchingCustomer(true);
      try {
        const res = await api.get('/customers', {
          params: { search: customerSearch.trim(), limit: 10 },
        });
        setSearchResults(Array.isArray(res.data) ? res.data : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchingCustomer(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [customerSearch, guestMode]);

  const stayNights = dates.check_in_date && dates.check_out_date
    ? nightsBetween(dates.check_in_date, dates.check_out_date)
    : 0;

  // Step 1 Validation -> Next
  const handleProceedToStep2 = () => {
    if (!selectedRoom) {
      toast.error('Please select an available room to proceed.');
      return;
    }
    setCurrentStep(1);
  };

  // Step 2 Validation -> Next
  const handleProceedToStep3 = () => {
    if (guestMode === 'existing') {
      if (!selectedCustomer) {
        toast.error('Please search and select an existing guest.');
        return;
      }
    } else {
      if (!newGuest.name.trim()) {
        toast.error('Please enter the guest full name.');
        return;
      }
      if (!newGuest.email.trim() || !newGuest.email.includes('@')) {
        toast.error('Please provide a valid email address for the guest.');
        return;
      }
    }
    setCurrentStep(2);
  };

  // Step 3 Submission
  const handleConfirmReservation = async () => {
    setSubmitting(true);
    try {
      const payload = {
        room_id: selectedRoom.room_id,
        check_in_date: dates.check_in_date,
        check_out_date: dates.check_out_date,
        guests: dates.guests,
        remark: remark.trim() || null,
      };

      if (guestMode === 'existing') {
        payload.customer_id = selectedCustomer.customer_id;
      } else {
        payload.customer = {
          name: newGuest.name.trim(),
          email: newGuest.email.trim(),
          phone: newGuest.phone.trim() || null,
        };
      }

      const res = await api.post('/reservations/staff', payload);
      setCreatedBooking(res.data);
      setCurrentStep(3); // success view
      toast.success(`Reservation ${res.data.booking_ref} created successfully!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create reservation.');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset wizard
  const handleReset = () => {
    setDates({
      check_in_date: todayStr,
      check_out_date: '',
      guests: 1,
    });
    setRooms([]);
    setSelectedRoom(null);
    setSelectedCustomer(null);
    setCustomerSearch('');
    setNewGuest({ name: '', email: '', phone: '' });
    setRemark('');
    setCreatedBooking(null);
    setCurrentStep(0);
  };

  // One-click Check In for newly created reservation (if check_in is today)
  const handleImmediateCheckIn = async () => {
    if (!createdBooking?.booking_ref) return;
    try {
      await api.patch(`/reservations/${createdBooking.booking_ref}/check-in`);
      toast.success(`Guest checked in to Room ${createdBooking.room_number || selectedRoom?.room_number}!`);
      navigate('/reception');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to check in.');
    }
  };

  const guestDisplayName = guestMode === 'existing'
    ? selectedCustomer?.name
    : newGuest.name;
  const guestDisplayEmail = guestMode === 'existing'
    ? selectedCustomer?.email
    : newGuest.email;
  const guestDisplayPhone = guestMode === 'existing'
    ? selectedCustomer?.phone
    : newGuest.phone;

  return (
    <div className="page-content slide-up" style={{ paddingBottom: 60 }}>
      {/* Top Header */}
      <div style={{ marginBottom: 24 }}>
        <Eyebrow text="FRONT DESK BOOKING" />
        <h1 className="page-title" style={{ marginTop: 4, marginBottom: 6 }}>
          New Reservation
        </h1>
        <p className="page-subtitle" style={{ margin: 0 }}>
          Create and confirm a reservation on behalf of a walk-in or phone guest.
        </p>
      </div>

      {/* Stepper (Only active during steps 0, 1, 2) */}
      {currentStep < 3 && (
        <div style={{ maxWidth: 640, margin: '0 auto 36px' }}>
          <Stepper steps={STEPS} currentStep={currentStep} />
        </div>
      )}

      {/* STEP 1: DATES, GUESTS & BOOKABLE ROOMS */}
      {currentStep === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 960, margin: '0 auto' }}>
          {/* Date & Guest Input Bar */}
          <div className="card-ui" style={{ padding: 24 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                alignItems: 'flex-end',
              }}
            >
              <FormField label="Check-In Date" required>
                <Input
                  type="date"
                  min={todayStr}
                  value={dates.check_in_date}
                  onChange={(e) => setDates({ ...dates, check_in_date: e.target.value })}
                />
              </FormField>

              <FormField label="Check-Out Date" required>
                <Input
                  type="date"
                  min={dates.check_in_date || todayStr}
                  value={dates.check_out_date}
                  onChange={(e) => setDates({ ...dates, check_out_date: e.target.value })}
                />
              </FormField>

              <FormField label="Guests" required>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={dates.guests}
                  onChange={(e) => setDates({ ...dates, guests: parseInt(e.target.value, 10) || 1 })}
                />
              </FormField>

              <div>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={fetchBookableRooms}
                  loading={loadingRooms}
                  disabled={!dates.check_in_date || !dates.check_out_date}
                >
                  Search Available Rooms
                </Button>
              </div>
            </div>
          </div>

          {/* Bookable Rooms Results */}
          {loadingRooms ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              <Skeleton height={180} />
              <Skeleton height={180} />
              <Skeleton height={180} />
            </div>
          ) : rooms.length > 0 ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {rooms.length} Bookable Room{rooms.length === 1 ? '' : 's'} for {stayNights} Night{stayNights === 1 ? '' : 's'}
                </span>
                {selectedRoom && (
                  <span style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600 }}>
                    Selected: Room {selectedRoom.room_number} ({selectedRoom.room_type})
                  </span>
                )}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                {rooms.map((r) => {
                  const isSelected = selectedRoom?.room_id === r.room_id;
                  return (
                    <div
                      key={r.room_id}
                      onClick={() => setSelectedRoom(r)}
                      className={`card-ui is-clickable ${isSelected ? 'is-selected' : ''}`}
                      style={{
                        padding: 20,
                        border: isSelected ? '1px solid var(--gold)' : '1px solid var(--border)',
                        background: isSelected ? 'rgba(200, 169, 106, 0.08)' : 'var(--card)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span
                            style={{
                              fontSize: 11,
                              textTransform: 'uppercase',
                              letterSpacing: '0.1em',
                              color: 'var(--gold)',
                              fontWeight: 600,
                            }}
                          >
                            Room {r.room_number}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                            Max {r.capacity} Guests
                          </span>
                        </div>

                        <h3 className="font-serif" style={{ fontSize: 18, color: 'var(--text)', margin: '6px 0 8px' }}>
                          {r.room_type}
                        </h3>

                        {r.view_label && (
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                            {r.view_label} {r.bed_type ? `· ${r.bed_type} Bed` : ''}
                          </div>
                        )}
                      </div>

                      <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)', marginTop: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <div>
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Rate</span>
                            <div style={{ fontSize: 13, color: 'var(--text)' }}>
                              {formatLKR(r.price)} / night
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)' }}>Stay Total</span>
                            <div className="font-serif" style={{ fontSize: 17, color: 'var(--gold)', fontWeight: 700 }}>
                              {formatLKR(r.total)}
                            </div>
                          </div>
                        </div>

                        <Button
                          variant={isSelected ? 'primary' : 'secondary'}
                          size="sm"
                          className="w-full"
                          style={{ marginTop: 12 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRoom(r);
                          }}
                        >
                          {isSelected ? 'Selected' : 'Choose Room'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Step 1 Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <Button
                  variant="primary"
                  onClick={handleProceedToStep2}
                  disabled={!selectedRoom}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  <span>Continue to Guest Details</span>
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* STEP 2: CHOOSE OR CREATE CUSTOMER */}
      {currentStep === 1 && (
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div className="card-ui" style={{ padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <User size={20} style={{ color: 'var(--gold)' }} />
              <h2 className="font-serif" style={{ margin: 0, fontSize: 20, color: 'var(--text)' }}>
                Guest Information
              </h2>
            </div>

            {/* Guest Mode Selector Toggle */}
            <div
              style={{
                display: 'flex',
                background: 'var(--bg)',
                borderRadius: 'var(--radius)',
                padding: 4,
                border: '1px solid var(--border)',
                marginBottom: 24,
              }}
            >
              <button
                type="button"
                className={`btn-ui ${guestMode === 'existing' ? 'btn-ui-primary' : 'btn-ui-ghost'}`}
                style={{ flex: 1, borderRadius: 'var(--radius)', fontSize: 13 }}
                onClick={() => {
                  setGuestMode('existing');
                  setSelectedCustomer(null);
                }}
              >
                Existing Guest (Search)
              </button>
              <button
                type="button"
                className={`btn-ui ${guestMode === 'new' ? 'btn-ui-primary' : 'btn-ui-ghost'}`}
                style={{ flex: 1, borderRadius: 'var(--radius)', fontSize: 13 }}
                onClick={() => setGuestMode('new')}
              >
                New Guest (Walk-in)
              </button>
            </div>

            {/* Mode 1: Search Existing Guest with Typeahead */}
            {guestMode === 'existing' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {!selectedCustomer ? (
                  <div style={{ position: 'relative' }}>
                    <FormField
                      label="Search Existing Guest"
                      hint="Search by guest name, email, or telephone number"
                    >
                      <div style={{ position: 'relative' }}>
                        <Input
                          icon={Search}
                          placeholder="Start typing guest name or email..."
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                        />
                      </div>
                    </FormField>

                    {/* Typeahead Dropdown Results */}
                    {searchingCustomer && (
                      <div style={{ padding: 12, color: 'var(--muted)', fontSize: 13, fontStyle: 'italic' }}>
                        Searching guests...
                      </div>
                    )}
                    {searchResults.length > 0 && (
                      <div
                        style={{
                          marginTop: 6,
                          maxHeight: 220,
                          overflowY: 'auto',
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        {searchResults.map((cust) => (
                          <div
                            key={cust.customer_id}
                            onClick={() => {
                              setSelectedCustomer(cust);
                              setCustomerSearch('');
                              setSearchResults([]);
                            }}
                            style={{
                              padding: '10px 14px',
                              borderBottom: '1px solid var(--border)',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(200, 169, 106, 0.08)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>
                                {cust.name}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                {cust.email} · {cust.phone || 'No phone'}
                              </div>
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--gold)' }}>Select</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {customerSearch.trim() && !searchingCustomer && searchResults.length === 0 && (
                      <div style={{ padding: 12, color: 'var(--muted)', fontSize: 13, fontStyle: 'italic' }}>
                        No guests found. Switch to "New Guest" above to register a walk-in guest.
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      padding: 16,
                      background: 'var(--bg)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 'var(--radius)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--gold)', letterSpacing: '0.1em' }}>
                        Selected Guest
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>
                        {selectedCustomer.name}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                        {selectedCustomer.email} · {selectedCustomer.phone || 'No phone'}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCustomer(null)}
                      style={{ fontSize: 12, color: 'var(--muted)' }}
                    >
                      Change
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              /* Mode 2: Register New Walk-In Guest */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <FormField label="Full Name" required>
                  <Input
                    icon={User}
                    placeholder="e.g. Liam Sterling"
                    value={newGuest.name}
                    onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })}
                  />
                </FormField>

                <FormField label="Email Address" required hint="Used for booking confirmation">
                  <Input
                    icon={Mail}
                    type="email"
                    placeholder="e.g. liam.sterling@example.com"
                    value={newGuest.email}
                    onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })}
                  />
                </FormField>

                <FormField label="Phone Number" hint="Optional reception contact number">
                  <Input
                    icon={Phone}
                    placeholder="e.g. +94 11 234 5678"
                    value={newGuest.phone}
                    onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })}
                  />
                </FormField>
              </div>
            )}

            <GoldDivider style={{ margin: '24px 0' }} />

            {/* Special Requests / Remarks */}
            <FormField label="Special Requests / Remarks (Optional)">
              <Textarea
                rows={3}
                placeholder="e.g. High floor preferred, quiet room, late arrival..."
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
              />
            </FormField>

            {/* Step 2 Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <Button variant="secondary" onClick={() => setCurrentStep(0)}>
                <ArrowLeft size={16} />
                <span>Back to Rooms</span>
              </Button>
              <Button variant="primary" onClick={handleProceedToStep3}>
                <span>Review & Confirm</span>
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: SUMMARY & CONFIRM */}
      {currentStep === 2 && selectedRoom && (
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div className="card-ui" style={{ padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <CheckCircle2 size={20} style={{ color: 'var(--gold)' }} />
              <h2 className="font-serif" style={{ margin: 0, fontSize: 20, color: 'var(--text)' }}>
                Confirm Reservation Summary
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Room details */}
              <div
                style={{
                  padding: 16,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.1em' }}>
                  Room & Stay
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginTop: 4 }}>
                  Room {selectedRoom.room_number} · {selectedRoom.room_type}
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                  {formatDate(dates.check_in_date)} to {formatDate(dates.check_out_date)} ({stayNights} Nights) · {dates.guests} Guest(s)
                </div>
              </div>

              {/* Guest details */}
              <div
                style={{
                  padding: 16,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.1em' }}>
                  Guest Details
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginTop: 4 }}>
                  {guestDisplayName}
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                  {guestDisplayEmail} · {guestDisplayPhone || 'No telephone provided'}
                </div>
                {remark && (
                  <div style={{ fontSize: 12, color: 'var(--gold)', marginTop: 6, fontStyle: 'italic' }}>
                    Remark: "{remark}"
                  </div>
                )}
              </div>

              {/* Billing summary */}
              <div
                style={{
                  padding: 16,
                  background: 'rgba(200, 169, 106, 0.05)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: 'var(--muted)' }}>Nightly Rate</span>
                  <span style={{ color: 'var(--text)' }}>{formatLKR(selectedRoom.price)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginTop: 4 }}>
                  <span style={{ color: 'var(--muted)' }}>Duration</span>
                  <span style={{ color: 'var(--text)' }}>{stayNights} nights</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    paddingTop: 10,
                    marginTop: 8,
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Total Amount</span>
                  <span className="font-serif" style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>
                    {formatLKR(selectedRoom.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Step 3 Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
              <Button
                variant="secondary"
                onClick={() => setCurrentStep(1)}
                disabled={submitting}
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmReservation}
                loading={submitting}
              >
                Confirm & Create Booking
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: SUCCESS CONFIRMATION SCREEN */}
      {currentStep === 3 && createdBooking && (
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <div className="card-ui" style={{ padding: '40px 32px' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'rgba(52, 211, 153, 0.12)',
                color: 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <CheckCircle2 size={36} />
            </div>

            <Eyebrow text="RESERVATION CONFIRMED" />
            <h2 className="font-serif" style={{ fontSize: 24, color: 'var(--text)', margin: '8px 0 10px' }}>
              Booking Created Successfully
            </h2>

            <div
              style={{
                padding: '12px 20px',
                background: 'var(--bg)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius)',
                display: 'inline-block',
                margin: '12px 0 24px',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block', textTransform: 'uppercase' }}>
                Booking Reference
              </span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'var(--gold)',
                  letterSpacing: '0.06em',
                }}
              >
                {createdBooking.booking_ref}
              </span>
            </div>

            <p style={{ color: 'var(--text-body)', fontSize: 14, margin: '0 0 28px' }}>
              Reservation confirmed for <strong>{guestDisplayName}</strong> in Room{' '}
              <strong>{createdBooking.room_number || selectedRoom?.room_number}</strong>.
            </p>

            {/* Success Actions */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                maxWidth: 360,
                margin: '0 auto',
              }}
            >
              {/* Record Payment */}
              <Button
                variant="primary"
                className="w-full"
                onClick={() => setShowDetailPanel(true)}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <CreditCard size={16} />
                <span>Record Payment</span>
              </Button>

              {/* Check in now (Only when check_in_date === today) */}
              {dates.check_in_date === todayStr && (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleImmediateCheckIn}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <LogIn size={16} />
                  <span>Check In Now</span>
                </Button>
              )}

              {/* Another Reservation */}
              <Button
                variant="ghost"
                className="w-full"
                onClick={handleReset}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <RotateCcw size={15} />
                <span>Another Reservation</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail panel integration for payment recording */}
      {createdBooking && (
        <ReservationDetailPanel
          bookingRef={createdBooking.booking_ref}
          isOpen={showDetailPanel}
          onClose={() => setShowDetailPanel(false)}
          onActionComplete={() => {
            setShowDetailPanel(false);
            navigate('/reception');
          }}
        />
      )}
    </div>
  );
}
