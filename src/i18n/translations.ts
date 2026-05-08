export type Lang = 'en' | 'fr';

interface AiTranslations {
  noMeasurementsTitle: string;
  noMeasurementsText: (name: string) => string;
<<<<<<< HEAD
=======
  airQualityAlertTitle: string;
  airQualityAlertText: (name: string, co2: number, threshold: number) => string;
  airQualityStableTitle: string;
  airQualityStableText: (name: string, co2: number) => string;
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
  pm25Title: string;
  pm25PollutedText: (name: string, pm: string, threshold: number) => string;
  pm25ModerateText: (name: string, pm: string, threshold: number) => string;
  pm25GoodText: (name: string, pm: string) => string;
  pm10Title: string;
  pm10PollutedText: (name: string, p10: string, threshold: number) => string;
  pm10ModerateText: (name: string, p10: string, threshold: number) => string;
  pm10GoodText: (name: string, p10: string, threshold: number) => string;
  coolingTitle: string;
  coolingText: (name: string, temp: string, target: string) => string;
  heatingTitle: string;
  heatingText: (name: string, temp: string) => string;
  temperatureTitle: string;
  temperatureIdealText: (name: string, temp: string) => string;
  brightnessTitle: string;
  brightnessHighText: (name: string, lux: number) => string;
  brightnessLowText: (name: string, lux: number) => string;
  brightnessIdealText: (name: string, lux: number) => string;
<<<<<<< HEAD
  noiseAlertTitle: string;
  noiseAlertText: (name: string, level: number) => string;
  noiseMediumTitle: string;
  noiseMediumText: (name: string, level: number) => string;
  noiseCalmTitle: string;
  noiseCalmText: (name: string, level: number) => string;
=======
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
  sensorDataTitle: string;
  sensorDataText: (name: string) => string;
}

interface SidebarTranslations {
  navigation: string;
  navDashboard: string;
  navRooms: string;
  navMonitoring: string;
  navAlerts: string;
  navSettings: string;
  aiStatus: string;
  allSystemsOperational: string;
  closeMenu: string;
  aiManager: string;
}

interface LoginTranslations {
  welcomeBack: string;
  signInSubtitle: string;
  emailLabel: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  rememberMe: string;
  forgotPassword: string;
  signingIn: string;
  signIn: string;
  footerNote: string;
  signInFailed: string;
  headline: string;
  subheadline: string;
  trustBadge: string;
  tileTempLabel: string;
  tileTempSub: string;
  tileAirLabel: string;
  tileAirSub: string;
  tileEnergyLabel: string;
  tileEnergySub: string;
  tileIotLabel: string;
  tileIotSub: string;
}

interface FirstLoginTranslations {
  title: string;
  greeting: (name: string) => string;
  newPasswordLabel: string;
  confirmPasswordLabel: string;
  saving: string;
  saveButton: string;
  errorMinLength: string;
  errorMismatch: string;
  errorWeakPassword: string;
  errorGeneric: string;
}

interface DashboardTranslations {
  title: string;
  subtitle: string;
  noDataYet: string;
  sensorTemp: string;
  sensorHumidity: string;
<<<<<<< HEAD
=======
  sensorCo2: string;
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
  sensorNoise: string;
  sensorLight: string;
  available: (n: number) => string;
  occupied: (n: number) => string;
  temperatureTrend: string;
<<<<<<< HEAD
=======
  co2Trend: string;
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
  lightTrend: string;
  noiseTrend: string;
  chartSubtitle: string;
  aiRecommendations: string;
  aiSubtitle: string;
  autoApplyOff: string;
  viewRooms: string;
  noSuggestions: string;
}

interface RoomsTranslations {
  title: string;
  subtitle: string;
  roomCount: (n: number) => string;
  addRoom: string;
  closeFormButton: string;
  newRoomTitle: string;
  editRoomTitle: string;
  closeFormAriaLabel: string;
  editHint: string;
  fieldRoomName: string;
  fieldCapacity: string;
  fieldIotDevice: string;
  iotDeviceHint: string;
  iotEditHint: string;
  iotEditLoading: string;
  noDevice: string;
  noDevicesInFirestore: string;
  cancel: string;
  saving: string;
  createRoom: string;
  saveChanges: string;
  detailsButton: string;
  searchPlaceholder: string;
  filterAll: string;
  filterAvailable: string;
  filterOccupied: string;
  capacity: (n: number) => string;
  statusOccupied: string;
  statusAvailable: string;
  validateNameRequired: string;
  validateCapacityRequired: string;
  toastRoomAdded: string;
  toastRoomAddedWithDevice: (deviceName: string) => string;
  toastRoomUpdated: string;
  toastRoomUpdatedWithDevice: (deviceName: string) => string;
  toastRoomDeleted: (roomName: string) => string;
  toastError: (err: string) => string;
  toastDeleteError: (err: string) => string;
  confirmDelete: (roomName: string) => string;
  editAriaLabel: (roomName: string) => string;
  deleteAriaLabel: (roomName: string) => string;
  sensorTemp: string;
  sensorHumidity: string;
<<<<<<< HEAD
=======
  sensorCo2: string;
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
  sensorNoise: string;
  sensorLight: string;
  sensorPm25: string;
  sensorPm10: string;
}

interface AlertsTranslations {
  title: string;
  subtitle: string;
  criticalBadge: (n: number) => string;
  warningBadge: (n: number) => string;
  toValidate: (n: number) => string;
  awaitingValidation: (n: number) => string;
  summaryTitle: string;
  summaryText: (n: number) => string;
  summaryTextWithPending: (n: number, p: number) => string;
  summaryHint: string;
  realtimeSync: string;
  statTotal: string;
  statCritical: string;
  statWarnings: string;
  statResolved: string;
  searchPlaceholder: string;
  filterAll: string;
  filterCritical: string;
  filterWarning: string;
  filterInfo: string;
  filterSuccess: string;
  showResolved: string;
  loading: string;
  noAlertsFound: string;
  noAlertsHint: string;
  badgeResolved: string;
  badgePending: string;
  roomLabel: string;
  categoryLabel: string;
  resolutionRequestLabel: string;
  requestedByLabel: string;
  resolvedByLabel: string;
  btnMarkResolved: string;
  btnRequestResolution: string;
  btnApproveResolution: string;
  btnDecline: string;
  awaitingAdmin: string;
  errorLoad: string;
  errorAction: string;
  errorApprove: string;
  errorDecline: string;
  defaultUserName: string;
}

interface SettingsTranslations {
  title: string;
  subtitle: string;
  statActiveUsers: string;
  statIotDevices: string;
  statDatabase: string;
  statAiConfig: string;
  tabUsers: string;
  tabDevices: string;
  tabRoomData: string;
  tabSystem: string;
  tabAi: string;
  addUser: string;
  addDevice: string;
}

export interface Translations {
  // App
  loading: string;

  // TopNav
  appTitle: string;
  notifications: string;
  notificationsUnread: (count: number) => string;
  viewAlerts: string;
  markAsRead: string;
  approve: string;
  decline: string;
  awaitingAdminApproval: string;
  noNotifications: string;
  switchToLight: string;
  switchToDark: string;
  signOut: string;
  openMenu: string;
  resolutionAccepted: string;
  resolutionRejected: string;
  by: string;

  // RoomDetails
  occupied: string;
  available: string;
  comfort: string;
  aiOptimizingRoom: string;
  aiAdjusting: string;
  temperature: string;
  humidity: string;
<<<<<<< HEAD
=======
  co2: string;
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
  noise: string;
  light: string;
  lightSliderLabel: (min: number, max: number) => string;
  lightSaveError: string;
  loadingMeasurements: string;
  temperatureChart: string;
<<<<<<< HEAD
=======
  co2Chart: string;
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
  noiseChart: string;
  lightChart: string;
  pm25Chart: string;
  aiAssistant: string;
  realtimeOptimization: string;
  realtimeData: string;
  showLightControl: string;
  hideLightControl: string;
  lastMotion: string;
  motionJustNow: string;
  motionMinutesAgo: (n: number) => string;
  motionHoursAgo: (n: number) => string;
  inactivityWarning: string;
  inactivityLoggedOut: string;

  // AI insights
  ai: AiTranslations;

  // Sidebar
  sidebar: SidebarTranslations;

  // Login
  login: LoginTranslations;

  // First login password change
  firstLogin: FirstLoginTranslations;

  // Main dashboard
  dashboard: DashboardTranslations;

  // Rooms management
  rooms: RoomsTranslations;

  // Alerts & notifications
  alerts: AlertsTranslations;

  // Admin settings
  settings: SettingsTranslations;
}

const chipLabelMap: Record<string, string> = {
  'Air bon': 'Good air',
  'Modéré': 'Moderate',
  'Air pollué': 'Polluted',
  'Zone idéale': 'Ideal zone',
  'Acceptable': 'Acceptable',
  'Hors zone': 'Out of range',
  'Idéal': 'Ideal',
  'À ajuster': 'Needs adjustment',
  'Hors plage': 'Out of range',
  [`Calme ✅`]: `Calm ✅`,
  [`Acceptable ⚠️`]: `Acceptable ⚠️`,
  [`Bruyant ❌`]: `Noisy ❌`,
  'Bon': 'Good',
  'Mauvais': 'Poor',
};

export function translateChipLabel(label: string, lang: Lang): string {
  if (lang === 'fr') return label;
  return chipLabelMap[label] ?? label;
}

export const translations: Record<Lang, Translations> = {
  en: {
    loading: 'Loading…',

    appTitle: 'Meeting Room Manager',
    notifications: 'Notifications',
    notificationsUnread: (count) => `Notifications (${count} unread)`,
    viewAlerts: 'View alerts →',
    markAsRead: 'Mark as read',
    approve: 'Approve',
    decline: 'Decline',
    awaitingAdminApproval: 'Awaiting admin approval.',
    noNotifications: 'No notifications',
    switchToLight: 'Switch to light mode',
    switchToDark: 'Switch to dark mode',
    signOut: 'Sign out',
    openMenu: 'Open menu',
    resolutionAccepted: 'Your resolution request has been accepted.',
    resolutionRejected: 'Your resolution request has been rejected.',
    by: 'By',

    occupied: 'Occupied',
    available: 'Available',
    comfort: 'Comfort',
    aiOptimizingRoom: 'AI is actively optimizing this room',
    aiAdjusting: 'Adjusting air quality and temperature for maximum comfort',
    temperature: 'Temperature',
    humidity: 'Humidity',
<<<<<<< HEAD
    noise: 'Sound Level',
=======
    co2: 'CO₂ (ppm)',
    noise: 'Noise (dB)',
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
    light: 'Light (lux)',
    lightSliderLabel: (min, max) => `Target ${min}–${max} lux (this room)`,
    lightSaveError: 'Unable to save. Please try again.',
    loadingMeasurements: 'Loading measurements…',
    temperatureChart: 'Temperature (24h)',
<<<<<<< HEAD
=======
    co2Chart: 'CO₂ Level (24h)',
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
    noiseChart: 'Noise Level (24h)',
    lightChart: 'Light Intensity (24h)',
    pm25Chart: 'PM2.5 (24h)',
    aiAssistant: 'AI Assistant',
    realtimeOptimization: 'Real-time optimization',
    realtimeData: 'Real-time data · updated on each sensor measurement',
    showLightControl: 'Light control',
    hideLightControl: 'Hide',
    lastMotion: 'Last motion',
    motionJustNow: 'just now',
    motionMinutesAgo: (n) => `${n} min ago`,
    motionHoursAgo: (n) => `${n} h ago`,
    inactivityWarning: 'You will be logged out in 1 minute due to inactivity.',
    inactivityLoggedOut: 'You were automatically logged out after 30 minutes of inactivity.',

    ai: {
      noMeasurementsTitle: 'No measurements yet',
      noMeasurementsText: (name) =>
        `${name}: Charts and live KPIs use the latest saved point by date and time. Add measurements from room updates or admin capture.`,
<<<<<<< HEAD
=======
      airQualityAlertTitle: 'Air Quality Alert',
      airQualityAlertText: (name, co2, threshold) =>
        `${name}: CO₂ at ${co2} ppm (above ~${threshold} ppm). Increasing ventilation to keep focus and comfort at optimal levels.`,
      airQualityStableTitle: 'Air Quality Stable',
      airQualityStableText: (name, co2) =>
        `${name}: CO₂ is under control (${co2} ppm). Ventilation remains in efficient mode.`,
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
      pm25Title: 'PM2.5 Particles',
      pm25PollutedText: (name, pm, threshold) =>
        `${name}: polluted air (PM2.5 ~${pm} µg/m³, threshold > ${threshold}). Ventilation or filtration (SDS011).`,
      pm25ModerateText: (name, pm, threshold) =>
        `${name}: moderate PM2.5 (${pm} µg/m³). Between "good air" (< 15) and "polluted" (> ${threshold}).`,
      pm25GoodText: (name, pm) =>
        `${name}: good air (PM2.5 ~${pm} µg/m³ < 15).`,
      pm10Title: 'PM10 Particles',
      pm10PollutedText: (name, p10, threshold) =>
        `${name}: polluted air (PM10 ~${p10} µg/m³, threshold > ${threshold}).`,
      pm10ModerateText: (name, p10, threshold) =>
        `${name}: moderate PM10 (~${p10} µg/m³). "Good air" threshold: < ${threshold}.`,
      pm10GoodText: (name, p10, threshold) =>
        `${name}: good air (PM10 ~${p10} µg/m³ < ${threshold}).`,
      coolingTitle: 'Cooling Optimization',
      coolingText: (name, temp, target) =>
        `${name}: Temperature at ${temp}°C. Targeting ~${target}°C for better comfort/energy balance.`,
      heatingTitle: 'Heating Optimization',
      heatingText: (name, temp) =>
        `${name}: Temperature at ${temp}°C. Slightly increasing HVAC output for comfort.`,
      temperatureTitle: 'Temperature',
      temperatureIdealText: (name, temp) =>
        `${name}: ideal zone 20–24 °C (${temp}°C).`,
      brightnessTitle: 'Brightness',
      brightnessHighText: (name, lux) =>
        `${name}: ${lux} lux — above the ideal zone 300–500 lux.`,
      brightnessLowText: (name, lux) =>
        `${name}: ${lux} lux — below the ideal zone 300–500 lux.`,
      brightnessIdealText: (name, lux) =>
        `${name}: ideal zone 300–500 lux (${lux} lux).`,
<<<<<<< HEAD
      noiseAlertTitle: 'High Noise Level',
      noiseAlertText: (name, level) =>
        `${name}: high noise level detected (${level}/100 — Loud). Identify and reduce the noise source.`,
      noiseMediumTitle: 'Moderate Noise',
      noiseMediumText: (name, level) =>
        `${name}: moderate noise level (${level}/100). Consider reducing distractions.`,
      noiseCalmTitle: 'Quiet Environment',
      noiseCalmText: (name, level) =>
        `${name}: calm environment (noise level: ${level}/100).`,
=======
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
      sensorDataTitle: 'Sensor data',
      sensorDataText: (name) =>
        `${name}: Latest record has no numeric values for the assistant yet (e.g. light-only history).`,
    },

    sidebar: {
      navigation: 'Navigation',
      navDashboard: 'Dashboard',
      navRooms: 'Rooms',
      navMonitoring: 'Live Monitoring',
      navAlerts: 'Alerts',
      navSettings: 'Settings',
      aiStatus: 'AI Status',
      allSystemsOperational: 'All systems operational',
      closeMenu: 'Close menu',
      aiManager: 'AI Manager',
    },

    login: {
      welcomeBack: 'Welcome back',
      signInSubtitle: 'Sign in to your SmartRoom account',
      emailLabel: 'Email address',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Enter your password',
      rememberMe: 'Remember me',
      forgotPassword: 'Forgot password?',
      signingIn: 'Signing in…',
      signIn: 'Sign in',
      footerNote: 'SmartRoom AI Manager · Secure sign-in',
      signInFailed: 'Sign-in failed. Please try again.',
      headline: 'Smart Building Intelligence',
      subheadline: 'AI-powered environment optimization for modern workspaces',
      trustBadge: 'Live sensor data · Firestore real-time sync',
      tileTempLabel: 'Temperature',
      tileTempSub: 'Real-time monitoring',
      tileAirLabel: 'Air Quality',
      tileAirSub: 'CO₂ & PM sensors',
      tileEnergyLabel: 'Energy',
      tileEnergySub: 'Smart optimization',
      tileIotLabel: 'IoT Sensors',
      tileIotSub: 'Connected devices',
    },

    firstLogin: {
      title: 'First login',
      greeting: (name) => `Hello ${name} — set your personal password to continue.`,
      newPasswordLabel: 'New password',
      confirmPasswordLabel: 'Confirm password',
      saving: 'Saving…',
      saveButton: 'Save and continue',
      errorMinLength: 'Password must be at least 6 characters.',
      errorMismatch: 'Passwords do not match.',
      errorWeakPassword: 'Password too weak (minimum 6 characters recommended: longer and varied).',
      errorGeneric: 'Unable to update password.',
    },

    dashboard: {
      title: 'Dashboard',
      subtitle: 'Overview · all rooms · last 24 h',
      noDataYet: 'No data yet',
      sensorTemp: 'Temperature',
      sensorHumidity: 'Humidity',
<<<<<<< HEAD
=======
      sensorCo2: 'CO₂',
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
      sensorNoise: 'Noise',
      sensorLight: 'Light',
      available: (n) => `${n} available`,
      occupied: (n) => `${n} occupied`,
      temperatureTrend: 'Temperature trend',
<<<<<<< HEAD
=======
      co2Trend: 'CO₂ level trend',
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
      lightTrend: 'Light intensity trend',
      noiseTrend: 'Noise level trend',
      chartSubtitle: 'Last 24 hours · all rooms · hourly avg',
      aiRecommendations: 'AI Recommendations',
      aiSubtitle: 'Based on latest sensor readings',
      autoApplyOff: 'Auto-apply off',
      viewRooms: 'View rooms',
      noSuggestions: 'No suggestions — add sensor data to rooms or lower AI aggressiveness in settings.',
    },

    rooms: {
      title: 'Meeting Rooms',
      subtitle: 'Manage and monitor all meeting rooms',
      roomCount: (n) => `${n} room${n !== 1 ? 's' : ''}`,
      addRoom: 'Add Room',
      closeFormButton: 'Close',
      newRoomTitle: 'New Room',
      editRoomTitle: 'Edit Room',
      closeFormAriaLabel: 'Close form',
      editHint: 'Occupancy (free/occupied) is updated automatically by the motion sensor. You can modify the name, capacity, and linked device.',
      fieldRoomName: 'Room name',
      fieldCapacity: 'Capacity (seats)',
      fieldIotDevice: 'IoT Device (optional)',
      iotDeviceHint: 'Choose a registered device (Admin → IoT Devices). It will be linked to this room (replaces previous link).',
      iotEditHint: 'Choose a device or none.',
      iotEditLoading: 'Loading current link…',
      noDevice: '— No device —',
      noDevicesInFirestore: 'No devices in Firestore. Add one in Settings → IoT Devices Management.',
      cancel: 'Cancel',
      saving: 'Saving…',
      createRoom: 'Create room',
      saveChanges: 'Save changes',
      detailsButton: 'Details',
      searchPlaceholder: 'Search rooms…',
      filterAll: 'All Status',
      filterAvailable: 'Available',
      filterOccupied: 'Occupied',
      capacity: (n) => `Capacity: ${n}`,
      statusOccupied: 'Occupied',
      statusAvailable: 'Available',
      validateNameRequired: 'Name required.',
      validateCapacityRequired: 'Capacity ≥ 1 required.',
      toastRoomAdded: 'Room added.',
      toastRoomAddedWithDevice: (name) => `Room created. Device "${name}" is now linked to this room.`,
      toastRoomUpdated: 'Room updated.',
      toastRoomUpdatedWithDevice: (name) => `Room updated. Device "${name}" is linked to this room.`,
      toastRoomDeleted: (name) => `Room "${name}" has been deleted.`,
      toastError: (err) => `Failed: ${err}`,
      toastDeleteError: (err) => `Delete failed: ${err}`,
      confirmDelete: (name) => `Delete room "${name}"?\n\nThis action is irreversible. Click OK to delete, or Cancel to abort.`,
      editAriaLabel: (name) => `Edit room ${name}`,
      deleteAriaLabel: (name) => `Delete room ${name}`,
      sensorTemp: 'Temp',
      sensorHumidity: 'Humidity',
<<<<<<< HEAD
=======
      sensorCo2: 'CO₂',
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
      sensorNoise: 'Noise',
      sensorLight: 'Light',
      sensorPm25: 'PM2.5',
      sensorPm10: 'PM10',
    },

    alerts: {
      title: 'Alerts & Notifications',
      subtitle: 'Real-time synced data (Firestore)',
      criticalBadge: (n) => `${n} Critical`,
      warningBadge: (n) => `${n} Warning`,
      toValidate: (n) => `${n} to validate`,
      awaitingValidation: (n) => `${n} awaiting admin validation`,
      summaryTitle: 'Alert Summary',
      summaryText: (n) => `You have ${n} unresolved alert${n !== 1 ? 's' : ''}.`,
      summaryTextWithPending: (n, p) => `You have ${n} unresolved alert${n !== 1 ? 's' : ''}, including ${p} awaiting validation.`,
      summaryHint: 'States are saved in Firestore: you can disconnect and validate later as admin.',
      realtimeSync: 'Real-time sync',
      statTotal: 'Total Alerts',
      statCritical: 'Critical',
      statWarnings: 'Warnings',
      statResolved: 'Resolved',
      searchPlaceholder: 'Search alerts…',
      filterAll: 'All Types',
      filterCritical: 'Critical',
      filterWarning: 'Warning',
      filterInfo: 'Info',
      filterSuccess: 'Success',
      showResolved: 'Show Resolved',
      loading: 'Loading alerts…',
      noAlertsFound: 'No alerts found',
      noAlertsHint: 'Try adjusting your filters',
      badgeResolved: 'Resolved',
      badgePending: 'Awaiting admin approval',
      roomLabel: 'Room:',
      categoryLabel: 'Category:',
      resolutionRequestLabel: 'Resolution request:',
      requestedByLabel: 'Requested by:',
      resolvedByLabel: 'Resolved by:',
      btnMarkResolved: 'Mark resolved',
      btnRequestResolution: 'Request resolution',
      btnApproveResolution: 'Approve resolution',
      btnDecline: 'Decline',
      awaitingAdmin: 'Awaiting administrator approval.',
      errorLoad: 'Unable to load alerts.',
      errorAction: 'Unable to save action. Please try again.',
      errorApprove: 'Unable to approve resolution. Please try again.',
      errorDecline: 'Unable to decline request. Please try again.',
      defaultUserName: 'User',
    },

    settings: {
      title: 'Admin & Settings',
      subtitle: 'Manage users, devices, and system configuration',
      statActiveUsers: 'Active users',
      statIotDevices: 'IoT Devices',
      statDatabase: 'Database',
      statAiConfig: 'AI Config',
      tabUsers: 'Users',
      tabDevices: 'IoT Devices',
      tabRoomData: 'Room Data',
      tabSystem: 'System',
      tabAi: 'AI Config',
      addUser: 'Add User',
      addDevice: 'Add Device',
    },
  },

  fr: {
    loading: 'Chargement…',

    appTitle: 'Gestionnaire de salles',
    notifications: 'Notifications',
    notificationsUnread: (count) => `Notifications (${count} non lues)`,
    viewAlerts: 'Voir les alertes →',
    markAsRead: 'Marquer comme lu',
    approve: 'Approuver',
    decline: 'Refuser',
    awaitingAdminApproval: "En attente d'approbation admin.",
    noNotifications: 'Aucune notification',
    switchToLight: 'Passer en mode clair',
    switchToDark: 'Passer en mode sombre',
    signOut: 'Se déconnecter',
    openMenu: 'Ouvrir le menu',
    resolutionAccepted: 'Votre demande de résolution a été acceptée.',
    resolutionRejected: 'Votre demande de résolution a été refusée.',
    by: 'Par',

    occupied: 'Occupée',
    available: 'Disponible',
    comfort: 'Confort',
    aiOptimizingRoom: "L'IA optimise activement cette salle",
    aiAdjusting:
      "Ajustement de la qualité de l'air et de la température pour un confort optimal",
    temperature: 'Température',
    humidity: 'Humidité',
<<<<<<< HEAD
    noise: 'Niveau sonore',
=======
    co2: 'CO₂ (ppm)',
    noise: 'Bruit (dB)',
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
    light: 'Lumière (lux)',
    lightSliderLabel: (min, max) => `Cible ${min}–${max} lux (cette salle)`,
    lightSaveError: 'Enregistrement impossible. Réessayez.',
    loadingMeasurements: 'Chargement des mesures…',
    temperatureChart: 'Température (24h)',
<<<<<<< HEAD
=======
    co2Chart: 'Niveau CO₂ (24h)',
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
    noiseChart: 'Niveau sonore (24h)',
    lightChart: 'Intensité lumineuse (24h)',
    pm25Chart: 'PM2.5 (24h)',
    aiAssistant: 'Assistant IA',
    realtimeOptimization: 'Optimisation en temps réel',
    realtimeData: 'Données en temps réel · mise à jour à chaque mesure capteur',
    showLightControl: 'Contrôle lumière',
    hideLightControl: 'Masquer',
    lastMotion: 'Dernier mouvement',
    motionJustNow: 'à l\'instant',
    motionMinutesAgo: (n) => `il y a ${n} min`,
    motionHoursAgo: (n) => `il y a ${n} h`,
    inactivityWarning: 'Vous serez déconnecté dans 1 minute pour inactivité.',
    inactivityLoggedOut: 'Vous avez été déconnecté automatiquement après 30 minutes d\'inactivité.',

    ai: {
      noMeasurementsTitle: 'Pas de mesures',
      noMeasurementsText: (name) =>
        `${name} : les graphiques et indicateurs utilisent le dernier point enregistré. Ajoutez des mesures depuis les mises à jour de salle ou la capture admin.`,
<<<<<<< HEAD
=======
      airQualityAlertTitle: "Alerte qualité de l'air",
      airQualityAlertText: (name, co2, threshold) =>
        `${name} : CO₂ à ${co2} ppm (au-dessus de ~${threshold} ppm). Augmentation de la ventilation pour maintenir focus et confort.`,
      airQualityStableTitle: "Qualité de l'air stable",
      airQualityStableText: (name, co2) =>
        `${name} : CO₂ sous contrôle (${co2} ppm). La ventilation reste en mode efficace.`,
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
      pm25Title: 'Particules PM2.5',
      pm25PollutedText: (name, pm, threshold) =>
        `${name} : air pollué (PM2.5 ~${pm} µg/m³, seuil > ${threshold}). Ventilation ou filtration (SDS011).`,
      pm25ModerateText: (name, pm, threshold) =>
        `${name} : PM2.5 modéré (${pm} µg/m³). Entre « air bon » (< 15) et « pollué » (> ${threshold}).`,
      pm25GoodText: (name, pm) =>
        `${name} : air bon (PM2.5 ~${pm} µg/m³ < 15).`,
      pm10Title: 'Particules PM10',
      pm10PollutedText: (name, p10, threshold) =>
        `${name} : air pollué (PM10 ~${p10} µg/m³, seuil > ${threshold}).`,
      pm10ModerateText: (name, p10, threshold) =>
        `${name} : PM10 modéré (~${p10} µg/m³). Seuil « air bon » : < ${threshold}.`,
      pm10GoodText: (name, p10, threshold) =>
        `${name} : air bon (PM10 ~${p10} µg/m³ < ${threshold}).`,
      coolingTitle: 'Optimisation refroidissement',
      coolingText: (name, temp, target) =>
        `${name} : température à ${temp}°C. Cible ~${target}°C pour un meilleur équilibre confort/énergie.`,
      heatingTitle: 'Optimisation chauffage',
      heatingText: (name, temp) =>
        `${name} : température à ${temp}°C. Légère augmentation de la puissance HVAC pour le confort.`,
      temperatureTitle: 'Température',
      temperatureIdealText: (name, temp) =>
        `${name} : zone idéale 20–24 °C (${temp}°C).`,
      brightnessTitle: 'Luminosité',
      brightnessHighText: (name, lux) =>
        `${name} : ${lux} lux — au-dessus de la zone idéale 300–500 lux.`,
      brightnessLowText: (name, lux) =>
        `${name} : ${lux} lux — en dessous de la zone idéale 300–500 lux.`,
      brightnessIdealText: (name, lux) =>
        `${name} : zone idéale 300–500 lux (${lux} lux).`,
<<<<<<< HEAD
      noiseAlertTitle: 'Niveau sonore élevé',
      noiseAlertText: (name, level) =>
        `${name} : niveau sonore élevé détecté (${level}/100 — Fort). Identifier et réduire la source de bruit.`,
      noiseMediumTitle: 'Bruit modéré',
      noiseMediumText: (name, level) =>
        `${name} : niveau sonore à ${level}/100 (Moyen). Envisager de réduire les sources de distraction.`,
      noiseCalmTitle: 'Environnement calme',
      noiseCalmText: (name, level) =>
        `${name} : environnement calme (niveau sonore : ${level}/100).`,
=======
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
      sensorDataTitle: 'Données capteurs',
      sensorDataText: (name) =>
        `${name} : le dernier enregistrement n'a pas encore de valeurs numériques pour l'assistant (ex. historique lumière uniquement).`,
    },

    sidebar: {
      navigation: 'Navigation',
      navDashboard: 'Tableau de bord',
      navRooms: 'Salles',
      navMonitoring: 'Monitoring en direct',
      navAlerts: 'Alertes',
      navSettings: 'Paramètres',
      aiStatus: 'Statut IA',
      allSystemsOperational: 'Tous les systèmes opérationnels',
      closeMenu: 'Fermer le menu',
      aiManager: 'IA Manager',
    },

    login: {
      welcomeBack: 'Bienvenue',
      signInSubtitle: 'Connectez-vous à votre compte SmartRoom',
      emailLabel: 'Adresse e-mail',
      passwordLabel: 'Mot de passe',
      passwordPlaceholder: 'Entrez votre mot de passe',
      rememberMe: 'Se souvenir de moi',
      forgotPassword: 'Mot de passe oublié ?',
      signingIn: 'Connexion…',
      signIn: 'Se connecter',
      footerNote: 'SmartRoom AI Manager · Connexion sécurisée',
      signInFailed: 'Échec de la connexion. Veuillez réessayer.',
      headline: 'Intelligence bâtiment',
      subheadline: "Optimisation de l'environnement par IA pour espaces de travail modernes",
      trustBadge: 'Données capteurs en direct · Sync Firestore temps réel',
      tileTempLabel: 'Température',
      tileTempSub: 'Surveillance temps réel',
      tileAirLabel: "Qualité de l'air",
      tileAirSub: 'Capteurs CO₂ & PM',
      tileEnergyLabel: 'Énergie',
      tileEnergySub: 'Optimisation intelligente',
      tileIotLabel: 'Capteurs IoT',
      tileIotSub: 'Appareils connectés',
    },

    firstLogin: {
      title: 'Première connexion',
      greeting: (name) => `Bonjour ${name} — définissez votre mot de passe personnel pour continuer.`,
      newPasswordLabel: 'Nouveau mot de passe',
      confirmPasswordLabel: 'Confirmer le mot de passe',
      saving: 'Enregistrement…',
      saveButton: "Enregistrer et accéder à l'application",
      errorMinLength: 'Le mot de passe doit contenir au moins 6 caractères.',
      errorMismatch: 'Les mots de passe ne correspondent pas.',
      errorWeakPassword: 'Mot de passe trop faible (minimum 6 caractères recommandé : plus long et varié).',
      errorGeneric: 'Impossible de mettre à jour le mot de passe.',
    },

    dashboard: {
      title: 'Tableau de bord',
      subtitle: "Vue d'ensemble · toutes les salles · dernières 24 h",
      noDataYet: 'Aucune donnée',
      sensorTemp: 'Température',
      sensorHumidity: 'Humidité',
<<<<<<< HEAD
=======
      sensorCo2: 'CO₂',
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
      sensorNoise: 'Bruit',
      sensorLight: 'Lumière',
      available: (n) => `${n} disponible${n !== 1 ? 's' : ''}`,
      occupied: (n) => `${n} occupée${n !== 1 ? 's' : ''}`,
      temperatureTrend: 'Tendance température',
<<<<<<< HEAD
=======
      co2Trend: 'Tendance CO₂',
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
      lightTrend: 'Tendance intensité lumineuse',
      noiseTrend: 'Tendance bruit',
      chartSubtitle: '24 dernières heures · toutes les salles · moy. horaire',
      aiRecommendations: 'Recommandations IA',
      aiSubtitle: 'Basé sur les dernières mesures capteurs',
      autoApplyOff: 'Application auto désactivée',
      viewRooms: 'Voir les salles',
      noSuggestions: "Aucune suggestion — ajoutez des données capteurs aux salles ou réduisez l'agressivité IA dans les paramètres.",
    },

    rooms: {
      title: 'Salles de réunion',
      subtitle: 'Gérez et surveillez toutes les salles de réunion',
      roomCount: (n) => `${n} salle${n !== 1 ? 's' : ''}`,
      addRoom: 'Ajouter une salle',
      closeFormButton: 'Fermer',
      newRoomTitle: 'Nouvelle salle',
      editRoomTitle: 'Modifier la salle',
      closeFormAriaLabel: 'Fermer le formulaire',
      editHint: "L'occupation (libre / occupée) est mise à jour automatiquement par le capteur de mouvement. Vous pouvez modifier le nom, la capacité et l'appareil lié.",
      fieldRoomName: 'Nom de la salle',
      fieldCapacity: 'Capacité (places)',
      fieldIotDevice: 'Appareil IoT (optionnel)',
      iotDeviceHint: "Choisissez un appareil déjà enregistré (Admin → IoT Devices). Il sera rattaché à cette nouvelle salle (remplace l'association précédente).",
      iotEditHint: 'Choisissez un appareil ou aucun.',
      iotEditLoading: "Chargement de l'association actuelle…",
      noDevice: '— Aucun appareil —',
      noDevicesInFirestore: "Aucun appareil dans Firestore. Ajoutez-en dans Paramètres → IoT Devices Management.",
      cancel: 'Annuler',
      saving: 'Enregistrement…',
      createRoom: 'Créer la salle',
      saveChanges: 'Enregistrer les modifications',
      detailsButton: 'Détails',
      searchPlaceholder: 'Rechercher des salles…',
      filterAll: 'Tous les statuts',
      filterAvailable: 'Disponible',
      filterOccupied: 'Occupée',
      capacity: (n) => `Capacité : ${n}`,
      statusOccupied: 'Occupée',
      statusAvailable: 'Disponible',
      validateNameRequired: 'Nom requis.',
      validateCapacityRequired: 'Capacité ≥ 1 requise.',
      toastRoomAdded: 'Salle ajoutée.',
      toastRoomAddedWithDevice: (name) => `Salle créée. L'appareil « ${name} » est maintenant associé à cette salle.`,
      toastRoomUpdated: 'Salle mise à jour.',
      toastRoomUpdatedWithDevice: (name) => `Salle mise à jour. L'appareil « ${name} » est associé à cette salle.`,
      toastRoomDeleted: (name) => `La salle « ${name} » a été supprimée.`,
      toastError: (err) => `Échec : ${err}`,
      toastDeleteError: (err) => `Échec de la suppression : ${err}`,
      confirmDelete: (name) => `Supprimer la salle « ${name} » ?\n\nCette action est irréversible. Cliquez sur OK pour supprimer, ou Annuler pour ne rien faire.`,
      editAriaLabel: (name) => `Modifier la salle ${name}`,
      deleteAriaLabel: (name) => `Supprimer la salle ${name}`,
      sensorTemp: 'Temp',
      sensorHumidity: 'Humidité',
<<<<<<< HEAD
=======
      sensorCo2: 'CO₂',
>>>>>>> de425048a4433d79704cfc35b86f357f42007b07
      sensorNoise: 'Bruit',
      sensorLight: 'Lumière',
      sensorPm25: 'PM2.5',
      sensorPm10: 'PM10',
    },

    alerts: {
      title: 'Alertes & Notifications',
      subtitle: 'Données synchronisées en temps réel (Firestore)',
      criticalBadge: (n) => `${n} Critique`,
      warningBadge: (n) => `${n} Avertissement`,
      toValidate: (n) => `${n} à valider`,
      awaitingValidation: (n) => `${n} en attente de validation admin`,
      summaryTitle: 'Résumé des alertes',
      summaryText: (n) => `Vous avez ${n} alerte${n !== 1 ? 's' : ''} non résolue${n !== 1 ? 's' : ''}.`,
      summaryTextWithPending: (n, p) => `Vous avez ${n} alerte${n !== 1 ? 's' : ''} non résolue${n !== 1 ? 's' : ''} dont ${p} en attente de validation.`,
      summaryHint: "Les états sont enregistrés dans Firestore : vous pouvez vous déconnecter et valider plus tard en tant qu'admin.",
      realtimeSync: 'Synchronisation temps réel',
      statTotal: 'Total alertes',
      statCritical: 'Critique',
      statWarnings: 'Avertissements',
      statResolved: 'Résolues',
      searchPlaceholder: 'Rechercher des alertes…',
      filterAll: 'Tous les types',
      filterCritical: 'Critique',
      filterWarning: 'Avertissement',
      filterInfo: 'Info',
      filterSuccess: 'Succès',
      showResolved: 'Afficher les résolues',
      loading: 'Chargement des alertes…',
      noAlertsFound: 'Aucune alerte trouvée',
      noAlertsHint: 'Essayez de modifier vos filtres',
      badgeResolved: 'Résolu',
      badgePending: 'En attente de validation admin',
      roomLabel: 'Salle :',
      categoryLabel: 'Catégorie :',
      resolutionRequestLabel: 'Demande de résolution :',
      requestedByLabel: 'Demandé par :',
      resolvedByLabel: 'Résolu par :',
      btnMarkResolved: 'Marquer résolu',
      btnRequestResolution: 'Demander résolution',
      btnApproveResolution: 'Valider la résolution',
      btnDecline: 'Refuser',
      awaitingAdmin: 'En attente de validation par un administrateur.',
      errorLoad: 'Impossible de charger les alertes.',
      errorAction: "Impossible d'enregistrer l'action. Réessayez.",
      errorApprove: 'Impossible de valider la résolution. Réessayez.',
      errorDecline: 'Impossible de refuser la demande. Réessayez.',
      defaultUserName: 'Utilisateur',
    },

    settings: {
      title: 'Admin & Paramètres',
      subtitle: 'Gérez les utilisateurs, appareils et la configuration système',
      statActiveUsers: 'Utilisateurs actifs',
      statIotDevices: 'Appareils IoT',
      statDatabase: 'Base de données',
      statAiConfig: 'Config IA',
      tabUsers: 'Utilisateurs',
      tabDevices: 'Appareils IoT',
      tabRoomData: 'Données salles',
      tabSystem: 'Système',
      tabAi: 'Config IA',
      addUser: 'Ajouter un utilisateur',
      addDevice: 'Ajouter un appareil',
    },
  },
};
