// Centralized selectors for CEMURM E2E tests
// Using data-testid attributes for stable selection

/** @type {const} */
export const selectors = {
  // Auth pages
  auth: {
    loginEmail: '[data-testid="login-email"]',
    loginPassword: '[data-testid="login-password"]',
    loginButton: '[data-testid="login-submit"]',
    loginError: '[data-testid="login-error"]',
    registerButton: '[data-testid="register-button"]',
    registerEmail: '[data-testid="register-email"]',
    registerPassword: '[data-testid="register-password"]',
    registerConfirmPassword: '[data-testid="register-confirm-password"]',
    registerSubmit: '[data-testid="register-submit"]',
    logoutButton: '[data-testid="logout-button"]',
    passwordResetEmail: '[data-testid="reset-email"]',
    passwordResetSubmit: '[data-testid="reset-submit"]',
    dateOfBirthInput: '[data-testid="dob-input"]',
    dateOfBirthSubmit: '[data-testid="dob-submit"]',
  },

  // Navigation
  nav: {
    appBar: '[data-testid="app-bar"]',
    homeLink: '[data-testid="nav-home"]',
    songsLink: '[data-testid="nav-songs"]',
    setlistsLink: '[data-testid="nav-setlists"]',
    gigsLink: '[data-testid="nav-gigs"]',
    libraryLink: '[data-testid="nav-library"]',
    theoryLink: '[data-testid="nav-theory"]',
    stageLink: '[data-testid="nav-stage"]',
    profileLink: '[data-testid="nav-profile"]',
    settingsLink: '[data-testid="nav-settings"]',
    userMenu: '[data-testid="user-menu"]',
  },

  // Songs
  songs: {
    list: '[data-testid="songs-list"]',
    searchInput: '[data-testid="songs-search"]',
    filterGenre: '[data-testid="songs-filter-genre"]',
    filterKey: '[data-testid="songs-filter-key"]',
    createButton: '[data-testid="song-create"]',
    songRow: '[data-testid="song-row"]',
    songTitle: '[data-testid="song-title"]',
    songArtist: '[data-testid="song-artist"]',
    editButton: '[data-testid="song-edit"]',
    deleteButton: '[data-testid="song-delete"]',
    viewButton: '[data-testid="song-view"]',
  },

  // Song Detail
  songDetail: {
    title: '[data-testid="song-detail-title"]',
    artist: '[data-testid="song-detail-artist"]',
    key: '[data-testid="song-detail-key"]',
    transposeControl: '[data-testid="transpose-control"]',
    capoSelector: '[data-testid="capo-selector"]',
    chordSheet: '[data-testid="chord-sheet"]',
    annotationButton: '[data-testid="add-annotation"]',
    exportButton: '[data-testid="song-export"]',
    printButton: '[data-testid="song-print"]',
  },

  // Setlists
  setlists: {
    list: '[data-testid="setlists-list"]',
    createButton: '[data-testid="setlist-create"]',
    setlistRow: '[data-testid="setlist-row"]',
    setlistName: '[data-testid="setlist-name"]',
    editButton: '[data-testid="setlist-edit"]',
    deleteButton: '[data-testid="setlist-delete"]',
    duplicateButton: '[data-testid="setlist-duplicate"]',
    viewButton: '[data-testid="setlist-view"]',
    shareButton: '[data-testid="setlist-share"]',
  },

  // Setlist Detail
  setlistDetail: {
    title: '[data-testid="setlist-detail-title"]',
    songList: '[data-testid="setlist-songs"]',
    songItem: '[data-testid="setlist-song-item"]',
    reorderHandle: '[data-testid="song-reorder"]',
    transposeAll: '[data-testid="setlist-transpose-all"]',
    exportPdf: '[data-testid="setlist-export-pdf"]',
    printLayout: '[data-testid="setlist-print"]',
    addSongButton: '[data-testid="setlist-add-song"]',
    removeSongButton: '[data-testid="setlist-remove-song"]',
  },

  // Gigs
  gigs: {
    list: '[data-testid="gigs-list"]',
    calendarView: '[data-testid="gigs-calendar"]',
    createButton: '[data-testid="gig-create"]',
    gigCard: '[data-testid="gig-card"]',
    gigName: '[data-testid="gig-name"]',
    gigDate: '[data-testid="gig-date"]',
    gigVenue: '[data-testid="gig-venue"]',
    editButton: '[data-testid="gig-edit"]',
    deleteButton: '[data-testid="gig-delete"]',
    viewButton: '[data-testid="gig-view"]',
  },

  // Gig Detail
  gigDetail: {
    name: '[data-testid="gig-detail-name"]',
    venue: '[data-testid="gig-detail-venue"]',
    date: '[data-testid="gig-detail-date"]',
    setlist: '[data-testid="gig-detail-setlist"]',
    checkInButton: '[data-testid="gig-checkin"]',
    launchSetlistButton: '[data-testid="gig-launch-setlist"]',
    notes: '[data-testid="gig-notes"]',
    attachments: '[data-testid="gig-attachments"]',
    shareButton: '[data-testid="gig-share"]',
  },

  // Stage Mode
  stage: {
    container: '[data-testid="stage-container"]',
    chordDisplay: '[data-testid="stage-chord-display"]',
    lyricsDisplay: '[data-testid="stage-lyrics"]',
    autoScrollToggle: '[data-testid="stage-autoscroll"]',
    metronomeToggle: '[data-testid="stage-metronome"]',
    metronomeTempo: '[data-testid="stage-metronome-tempo"]',
    nextSongButton: '[data-testid="stage-next-song"]',
    prevSongButton: '[data-testid="stage-prev-song"]',
    songProgress: '[data-testid="stage-song-progress"]',
    setlistProgress: '[data-testid="stage-setlist-progress"]',
    fullscreenToggle: '[data-testid="stage-fullscreen"]',
  },

  // Offline
  offline: {
    indicator: '[data-testid="offline-indicator"]',
    onlineBadge: '[data-testid="online-badge"]',
    offlineBadge: '[data-testid="offline-badge"]',
    syncStatus: '[data-testid="sync-status"]',
    queueDepth: '[data-testid="queue-depth"]',
    offlinePage: '[data-testid="offline-page"]',
    cachedContent: '[data-testid="cached-content"]',
    syncButton: '[data-testid="sync-trigger"]',
    conflictDialog: '[data-testid="conflict-dialog"]',
  },

  // Bandmates / Collaboration
  bandmates: {
    list: '[data-testid="bandmates-list"]',
    inviteButton: '[data-testid="bandmate-invite"]',
    inviteEmail: '[data-testid="invite-email"]',
    inviteRole: '[data-testid="invite-role"]',
    inviteSubmit: '[data-testid="invite-submit"]',
    memberRow: '[data-testid="bandmate-row"]',
    memberRole: '[data-testid="bandmate-role"]',
    removeButton: '[data-testid="bandmate-remove"]',
  },

  // Comments
  comments: {
    thread: '[data-testid="comment-thread"]',
    comment: '[data-testid="comment"]',
    replyButton: '[data-testid="comment-reply"]',
    replyInput: '[data-testid="reply-input"]',
    replySubmit: '[data-testid="reply-submit"]',
    mentionButton: '[data-testid="comment-mention"]',
    resolveButton: '[data-testid="comment-resolve"]',
    unresolveButton: '[data-testid="comment-unresolve"]',
  },

  // Public Library
  library: {
    grid: '[data-testid="library-grid"]',
    searchInput: '[data-testid="library-search"]',
    filterGenre: '[data-testid="library-filter-genre"]',
    filterKey: '[data-testid="library-filter-key"]',
    filterDifficulty: '[data-testid="library-filter-difficulty"]',
    filterLicense: '[data-testid="library-filter-license"]',
    songCard: '[data-testid="library-song-card"]',
    importButton: '[data-testid="library-import"]',
  },

  // Profile
  profile: {
    username: '[data-testid="profile-username"]',
    displayName: '[data-testid="profile-display-name"]',
    instrument: '[data-testid="profile-instrument"]',
    repertoire: '[data-testid="profile-repertoire"]',
    followedArtists: '[data-testid="profile-followed"]',
    settingsButton: '[data-testid="profile-settings"]',
  },

  // Theory
  theory: {
    reference: '[data-testid="theory-reference"]',
    scaleLookup: '[data-testid="scale-lookup"]',
    chordLookup: '[data-testid="chord-lookup"]',
    fretboard: '[data-testid="interactive-fretboard"]',
    intervalTrainer: '[data-testid="interval-trainer"]',
  },

  // Common UI
  common: {
    button: '[data-testid="button"]',
    input: '[data-testid="input"]',
    select: '[data-testid="select"]',
    modal: '[data-testid="modal"]',
    modalClose: '[data-testid="modal-close"]',
    modalConfirm: '[data-testid="modal-confirm"]',
    modalCancel: '[data-testid="modal-cancel"]',
    toast: '[data-testid="toast"]',
    loadingSpinner: '[data-testid="loading"]',
    errorMessage: '[data-testid="error-message"]',
    successMessage: '[data-testid="success-message"]',
    pagination: '[data-testid="pagination"]',
    pageSize: '[data-testid="page-size"]',
  },
};