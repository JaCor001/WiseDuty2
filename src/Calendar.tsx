import { useState, useEffect } from 'react'
import './Calendar.css'
import './App.css'

interface Event {
  id: string
  title: string
  start: Date
  end: Date
  type: 'duty' | 'rest'
  acclTZ?: string
}

// Get all IANA time zones with their current UTC offsets
const getTimeZonesWithOffsets = () => {
  const timeZones = Intl.supportedValuesOf('timeZone')
  return timeZones.map(tz => {
    const now = new Date()
    const offset = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset'
    }).formatToParts(now).find(part => part.type === 'timeZoneName')?.value || '+00:00'
    
    // Format the display name nicely
    const displayName = tz.replace(/_/g, ' ').replace(/\//g, ' / ')
    
    return {
      value: tz,
      label: `${displayName} (${offset})`
    }
  }).sort((a, b) => a.label.localeCompare(b.label))
}

const TIME_ZONES = getTimeZonesWithOffsets()

// Filter time zones based on search text
const getFilteredTimeZones = (searchText: string) => {
  if (!searchText) return TIME_ZONES
  return TIME_ZONES.filter(tz => 
    tz.label.toLowerCase().includes(searchText.toLowerCase()) ||
    tz.value.toLowerCase().includes(searchText.toLowerCase())
  )
}

// Custom Time Zone Selector Component
const TimeZoneSelector = ({ 
  value, 
  onChange, 
  placeholder = "Search time zones...",
  allowEmpty = false 
}: { 
  value: string, 
  onChange: (value: string) => void,
  placeholder?: string,
  allowEmpty?: boolean
}) => {
  const [searchText, setSearchText] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  
  const filteredZones = getFilteredTimeZones(searchText)
  const selectedZone = TIME_ZONES.find(tz => tz.value === value)
  
  const handleSelect = (tzValue: string) => {
    onChange(tzValue)
    setSearchText('')
    setShowDropdown(false)
  }
  
  return (
    <div className="timezone-selector" style={{ position: 'relative' }}>
      <input
        type="text"
        value={searchText || selectedZone?.label || ''}
        onChange={(e) => {
          setSearchText(e.target.value)
          setShowDropdown(true)
        }}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '0.5rem',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          background: 'var(--card-bg)',
          color: 'var(--text-color)'
        }}
      />
      {showDropdown && (
        <div 
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: '200px',
            overflowY: 'auto',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            background: 'var(--card-bg)',
            zIndex: 1000,
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
          }}
        >
          {allowEmpty && (
            <div
              onClick={() => handleSelect('')}
              style={{
                padding: '0.5rem',
                cursor: 'pointer',
                borderBottom: '1px solid var(--border-color)',
                background: value === '' ? 'var(--hover-bg)' : 'transparent'
              }}
            >
              Use global setting
            </div>
          )}
          {filteredZones.map(tz => (
            <div
              key={tz.value}
              onClick={() => handleSelect(tz.value)}
              style={{
                padding: '0.5rem',
                cursor: 'pointer',
                borderBottom: '1px solid var(--border-color)',
                background: value === tz.value ? 'var(--hover-bg)' : 'transparent'
              }}
            >
              {tz.label}
            </div>
          ))}
          {filteredZones.length === 0 && (
            <div style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>
              No time zones found
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [pressTimer, setPressTimer] = useState<number | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [menuDate, setMenuDate] = useState<Date | null>(null)
  const [showAddDuty, setShowAddDuty] = useState(false)
  const [addDutyDate, setAddDutyDate] = useState<Date | null>(null)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [modalAcclTZ, setModalAcclTZ] = useState('')
  const [restType, setRestType] = useState<'12h' | '10+travel'>('12h')
  const [sectors, setSectors] = useState(() => {
    try {
      return Number(localStorage.getItem('lastSectors')) || 1
    } catch {
      return 1
    }
  })
  const [avgSectorTime, setAvgSectorTime] = useState<'<30' | '30-50' | '>=50'>(() => {
    try {
      return (localStorage.getItem('lastAvgSectorTime') as '<30' | '30-50' | '>=50') || '<30'
    } catch {
      return '<30'
    }
  })
  const [referenceTZ, setReferenceTZ] = useState(() => {
    try {
      return localStorage.getItem('referenceTZ') || Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      return 'America/Vancouver'
    }
  })
  const [acclTZ, setAcclTZ] = useState(() => {
    try {
      const saved = localStorage.getItem('lastAcclTZ')
      if (saved) return saved
      // Default to user's current time zone if no saved value
      return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      return 'America/Vancouver'
    }
  })
  const [isEdit, setIsEdit] = useState(false)
  const [editEvent, setEditEvent] = useState<Event | null>(null)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    document.body.className = darkMode ? 'dark' : 'light'
  }, [darkMode])
  const [showSettings, setShowSettings] = useState(false)
  const [timeFormat, setTimeFormat] = useState<'24h' | '12h'>(() => {
    try {
      return (localStorage.getItem('timeFormat') as '24h' | '12h') || '24h'
    } catch {
      return '24h'
    }
  })
  const [regulator, setRegulator] = useState<'TC' | 'FAA' | 'EASA' | 'Australia'>(() => {
    try {
      return (localStorage.getItem('regulator') as 'TC' | 'FAA' | 'EASA' | 'Australia') || 'TC'
    } catch {
      return 'TC'
    }
  })
  const [maxDutyResult, setMaxDutyResult] = useState<string>('')
  const [validationMessage, setValidationMessage] = useState<string>('')

  const getMaxDutyFromTable = (startHour: number, sectors: number, avg: string) => {
    const getSectorGroup = (sec: number, avgType: string) => {
      if (avgType === '<30') {
        if (sec <= 11) return '1-11'
        if (sec <= 17) return '12-17'
        return '18+'
      } else if (avgType === '30-50') {
        if (sec <= 7) return '1-7'
        if (sec <= 11) return '8-11'
        return '12+'
      } else if (avgType === '>=50') {
        if (sec <= 4) return '1-4'
        if (sec <= 6) return '5-6'
        return '7+'
      }
      return '1-11' // fallback
    }
    const group = getSectorGroup(sectors, avg)
    const table: Record<string, Record<string, Record<string, number>>> = {
      '<30': {
        '1-11': { '24-03': 9, '04-04': 10, '05-05': 11, '06-06': 12, '07-12': 13, '13-16': 12.5, '17-21': 12, '22-22': 11, '23-23': 10 },
        '12-17': { '24-03': 9, '04-04': 9, '05-05': 10, '06-06': 11, '07-12': 12, '13-16': 11.5, '17-21': 11, '22-22': 10, '23-23': 9 },
        '18+': { '24-03': 9, '04-04': 9, '05-05': 9, '06-06': 10, '07-12': 11, '13-16': 10.5, '17-21': 10, '22-22': 9, '23-23': 9 }
      },
      '30-50': {
        '1-7': { '24-03': 9, '04-04': 10, '05-05': 11, '06-06': 12, '07-12': 13, '13-16': 12.5, '17-21': 12, '22-22': 11, '23-23': 10 },
        '8-11': { '24-03': 9, '04-04': 9, '05-05': 10, '06-06': 11, '07-12': 12, '13-16': 11.5, '17-21': 11, '22-22': 10, '23-23': 9 },
        '12+': { '24-03': 9, '04-04': 9, '05-05': 9, '06-06': 10, '07-12': 11, '13-16': 10.5, '17-21': 10, '22-22': 9, '23-23': 9 }
      },
      '>=50': {
        '1-4': { '24-03': 9, '04-04': 10, '05-05': 11, '06-06': 12, '07-12': 13, '13-16': 12.5, '17-21': 12, '22-22': 11, '23-23': 10 },
        '5-6': { '24-03': 9, '04-04': 9, '05-05': 10, '06-06': 11, '07-12': 12, '13-16': 11.5, '17-21': 11, '22-22': 10, '23-23': 9 },
        '7+': { '24-03': 9, '04-04': 9, '05-05': 9, '06-06': 10, '07-12': 11, '13-16': 10.5, '17-21': 10, '22-22': 9, '23-23': 9 }
      }
    }
    const getTimeSlot = (h: number) => {
      if (h >= 0 && h <= 3) return '24-03'
      if (h === 4) return '04-04'
      if (h === 5) return '05-05'
      if (h === 6) return '06-06'
      if (h >= 7 && h <= 12) return '07-12'
      if (h >= 13 && h <= 16) return '13-16'
      if (h >= 17 && h <= 21) return '17-21'
      if (h === 22) return '22-22'
      return '23-23'
    }
    const slot = getTimeSlot(startHour)
    return table[avg][group][slot] || 9
  }
  const maxWeeklyDuty = 60 // for CASA and others
  const now = new Date()
  const minMonth = new Date(now.getFullYear(), now.getMonth() - 13, 1)
  const maxMonth = new Date(now.getFullYear(), now.getMonth() + 3, 1)

  const getTotalDutyHours = (startDate: Date) => {
    const sevenDaysAgo = new Date(startDate)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return events
      .filter(e => e.type === 'duty' && e.start >= sevenDaysAgo && e.end <= startDate)
      .reduce((total, e) => total + (e.end.getTime() - e.start.getTime()) / (1000 * 60 * 60), 0)
  }

  const getCalendarDays = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)
    const startDate = new Date(firstDayOfMonth)
    startDate.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay())
    const endDate = new Date(lastDayOfMonth)
    endDate.setDate(lastDayOfMonth.getDate() + (6 - lastDayOfMonth.getDay()))
    const days = []
    let current = new Date(startDate)
    while (current <= endDate) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    return days
  }

  const getDayStatus = (date: Date) => {
    const dayEvents = events.filter(event =>
      event.start.toDateString() === date.toDateString() ||
      (event.start < date && event.end > date)
    )
    if (dayEvents.some(e => e.type === 'duty')) return 'blue'
    if (dayEvents.some(e => e.type === 'rest')) return 'amber'
    return 'white'
  }

  const renderEventBars = (date: Date) => {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)
    const dayEvents = events.filter(event => event.start < dayEnd && event.end > dayStart)
    return dayEvents.flatMap(event => {
      const isStart = event.start >= dayStart && event.start < dayEnd
      const isEnd = event.end > dayStart && event.end <= dayEnd
      let left = 0
      let width = 100
      if (isStart && !isEnd) {
        left = (event.start.getHours() / 24) * 100
        width = 100 - left
      } else if (isEnd && !isStart) {
        const effectiveEndHour = event.end.getHours() === 0 ? 24 : event.end.getHours()
        width = (effectiveEndHour / 24) * 100
      } else if (isStart && isEnd) {
        left = (event.start.getHours() / 24) * 100
        const effectiveEndHour = event.end.getHours() === 0 ? 24 : event.end.getHours()
        width = ((effectiveEndHour - event.start.getHours()) / 24) * 100
      }
      // For middle, left=0, width=100
      const nightStart = regulator === 'EASA' || regulator === 'Australia' ? 0 : regulator === 'FAA' ? 1 : 2
      const nightEnd = regulator === 'Australia' ? 5 : 6
      const markers = []
      const acclimatizedStartHour = getHourInTZ(event.start, event.acclTZ || acclTZ)
      const acclimatizedEndHour = getHourInTZ(event.end, event.acclTZ || acclTZ)
      if (regulator === 'TC') {
        if (acclimatizedStartHour >= 2 && acclimatizedStartHour < 7) markers.push('E')
        if (acclimatizedEndHour >= 0 && acclimatizedEndHour < 2) markers.push('L')
        if ((acclimatizedStartHour >= 13 || acclimatizedStartHour < 2) && acclimatizedEndHour > 1) markers.push('N')
      } else {
        if (acclimatizedStartHour < 6) markers.push('E')
        if (acclimatizedEndHour > 22) markers.push('L')
        if (acclimatizedStartHour < nightEnd && acclimatizedEndHour > nightStart) markers.push('N')
      }
      const bar = (
        <div
          key={event.id}
          className={`event-bar ${event.type}`}
          style={{ left: `${left}%`, width: `${width}%` }}
          title={event.title}
        />
      )
      const markerElements = markers.map(marker => (
        <span
          key={`${event.id}-${marker}`}
          className={`marker ${marker}`}
        >
          {marker}
        </span>
      ))
      return [bar, ...markerElements]
    })
  }

  const getDayActions = (date: Date) => {
    const dayEvents = events.filter(event =>
      event.start.toDateString() === date.toDateString()
    )
    const hasDuty = dayEvents.some(e => e.type === 'duty')
    return hasDuty ? ['Edit Duty', 'Delete Duty', 'Required Rest'] : ['Add Duty', 'Required Rest']
  }

  const handleMouseDown = (date: Date) => {
    const timer = setTimeout(() => {
      setSelectedDate(date) // Also select the date on long press
      setShowMenu(true)
      setMenuDate(date)
    }, 500)
    setPressTimer(timer)
  }

  const handleMouseUp = () => {
    if (pressTimer) {
      clearTimeout(pressTimer)
      setPressTimer(null)
    }
  }

  const handleClick = (date: Date) => {
    if (!showMenu) {
      if (date.getMonth() !== currentDate.getMonth()) {
        setAnimating(true)
        setTimeout(() => setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1)), 150)
        setTimeout(() => setAnimating(false), 300)
      } else {
        setSelectedDate(date)
      }
    }
  }

  const handleAddDuty = () => {
    setShowAddDuty(true)
    setShowMenu(false)
    setAddDutyDate(menuDate)
    setEndDate(menuDate ? menuDate.toISOString().slice(0, 10) : '')
    setRestType('12h')
    setIsEdit(false)
    setEditEvent(null)
  }

  const handleEditDuty = () => {
    const event = events.find(e => e.start.toDateString() === selectedDate?.toDateString())
    if (event && selectedDate) {
      setIsEdit(true)
      setEditEvent(event)
      setStartTime(event.start.toTimeString().slice(0, 5))
      setEndDate(event.end.toISOString().slice(0, 10))
      setEndTime(event.end.toTimeString().slice(0, 5))
      setModalAcclTZ(event.acclTZ || acclTZ)
      // Find associated rest event
      const restEvent = events.find(e => e.id === event.id + 'rest')
      if (restEvent) {
        const restDuration = (restEvent.end.getTime() - restEvent.start.getTime()) / (1000 * 60 * 60)
        setRestType(restDuration === 10 ? '10+travel' : '12h')
      } else {
        setRestType('12h')
      }
      setShowAddDuty(true)
      setShowMenu(false)
    }
  }

  const handleDeleteDuty = () => {
    const event = events.find(e => e.start.toDateString() === selectedDate?.toDateString())
    if (event) {
      // Remove both the duty event and its associated rest event
      const restEventId = event.id + 'rest'
      setEvents(events.filter(e => e !== event && e.id !== restEventId))
      setSelectedDate(null)
    }
  }

  const handleSubmitDuty = () => {
    setValidationMessage('') // Clear previous messages
    if (!addDutyDate || !startTime || !endTime || !endDate) {
      setValidationMessage('Please fill in all required fields: Start Time, End Date, and End Time')
      return
    }
    const start = new Date(addDutyDate.toDateString() + ' ' + startTime)
    const end = new Date(endDate + 'T' + endTime)
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setValidationMessage('Invalid date/time format. Please check your inputs.')
      return
    }
    
    if (start >= end) {
      setValidationMessage('End time must be after start time.')
      return
    }
    
    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    const acclimatizedStartHour = getHourInTZ(start, modalAcclTZ || acclTZ)
    const maxDuty = regulator === 'TC' ? getMaxDutyFromTable(acclimatizedStartHour, sectors, avgSectorTime) : regulator === 'EASA' ? 13 : 14
    const minRest = regulator === 'TC' || regulator === 'EASA' ? 12 : 10
    const actualRestHours = restType === '10+travel' ? 10 : minRest
    if (duration > maxDuty) {
      setValidationMessage(`FDP exceeds table limit for ${regulator === 'TC' ? 'CAR 705' : regulator}`)
      return
    }
    const totalWeekly = getTotalDutyHours(start) + duration
    if (totalWeekly > maxWeeklyDuty) {
      setValidationMessage(`Total hours of work in 7 days would exceed ${maxWeeklyDuty} hours for ${regulator === 'TC' ? 'CAR 705' : regulator}`)
      return
    }
    if (isEdit && editEvent) {
      editEvent.start = start
      editEvent.end = end
      editEvent.acclTZ = modalAcclTZ || acclTZ
      // Update associated rest event
      const restEvent = events.find(e => e.id === editEvent.id + 'rest')
      if (restEvent) {
        const restStart = new Date(end)
        const restEnd = new Date(restStart)
        restEnd.setHours(restEnd.getHours() + actualRestHours)
        restEvent.start = restStart
        restEvent.end = restEnd
        restEvent.title = restType === '10+travel' ? 'Required Rest (10+travel)' : 'Required Rest'
      }
      setEvents([...events])
      
      // Handle 10+travel notifications for edited duties
      if (restType === '10+travel') {
        const now = new Date()
        const hoursSinceRelease = (now.getTime() - end.getTime()) / (1000 * 60 * 60)
        
        if (now > end) {
          if (hoursSinceRelease > 15) {
            // More than 15 hours since release - just prompt to update
            setValidationMessage('More than 15 hours have passed since the release time. Please update the release time to reflect the actual time at the rest location.')
            // Keep the modal open for further editing
            return
          } else {
            // Within 15 hours - prompt to modify
            setValidationMessage('The release time has already passed. Please modify the end time of the duty to reflect the actual release time.')
            // Keep the modal open for further editing
            return
          }
        } else {
          const wantsNotifications = confirm('Would you like a notification 30 minutes after the release time to remember to confirm the new release time with your company?')
          if (wantsNotifications) {
            const timeToFirstNotification = end.getTime() - now.getTime() + (30 * 60 * 1000)
            setTimeout(() => {
              alert('Reminder: Confirm the new release time with your company (at the hotel room, key in hand or established rest location).')
              setTimeout(() => {
                alert('Follow-up: Please update the release time on the app to reflect the actual time at the rest location.')
              }, 30 * 60 * 1000)
            }, timeToFirstNotification)
          }
        }
      }
    } else {
      const newEvent: Event = {
        id: Date.now().toString(),
        title: 'Duty Period',
        start,
        end,
        type: 'duty',
        acclTZ: modalAcclTZ || acclTZ
      }
      const restStart = new Date(end)
      const restEnd = new Date(restStart)
      restEnd.setHours(restEnd.getHours() + actualRestHours)
      const restEvent: Event = {
        id: Date.now().toString() + 'rest',
        title: restType === '10+travel' ? 'Required Rest (10+travel)' : 'Required Rest',
        start: restStart,
        end: restEnd,
        type: 'rest'
      }
      setEvents([...events, newEvent, restEvent])
      
      // Handle 10+travel notifications for new duties
      if (restType === '10+travel') {
        const now = new Date()
        const hoursSinceRelease = (now.getTime() - end.getTime()) / (1000 * 60 * 60)
        
        if (now > end) {
          if (hoursSinceRelease > 15) {
            // More than 15 hours since release - just prompt to update
            setValidationMessage('More than 15 hours have passed since the original release time. Please update the release time to reflect the actual time at the rest location.')
            // Re-open the edit modal for this duty
            setIsEdit(true)
            setEditEvent(newEvent)
            setStartTime(newEvent.start.toTimeString().slice(0, 5))
            setEndDate(newEvent.end.toISOString().slice(0, 10))
            setEndTime(newEvent.end.toTimeString().slice(0, 5))
            setModalAcclTZ(newEvent.acclTZ || acclTZ)
            setRestType('10+travel')
            setShowAddDuty(true)
            return // Don't reset the form
          } else {
            // Within 15 hours - original logic
            setValidationMessage('The original release time has already passed. Please modify the end time of the duty to reflect the actual release time at the hotel.')
            // Re-open the edit modal for this duty
            setIsEdit(true)
            setEditEvent(newEvent)
            setStartTime(newEvent.start.toTimeString().slice(0, 5))
            setEndDate(newEvent.end.toISOString().slice(0, 10))
            setEndTime(newEvent.end.toTimeString().slice(0, 5))
            setModalAcclTZ(newEvent.acclTZ || acclTZ)
            setRestType('10+travel')
            setShowAddDuty(true)
            return // Don't reset the form
          }
        } else {
          // Ask about notifications
          const wantsNotifications = confirm('Would you like a notification 30 minutes after the original release time to remember to confirm the new release time with your company?')
          if (wantsNotifications) {
            const timeToFirstNotification = end.getTime() - now.getTime() + (30 * 60 * 1000) // 30 minutes after end
            setTimeout(() => {
              alert('Reminder: Confirm the new release time with your company (at the hotel room, key in hand or established rest location).')
              // Follow-up notification 30 minutes later
              setTimeout(() => {
                alert('Follow-up: Please update the release time on the app to reflect the actual time at the rest location.')
              }, 30 * 60 * 1000) // 30 minutes
            }, timeToFirstNotification)
          }
        }
      }
    }
    
    setShowAddDuty(false)
    setStartTime('')
    setEndTime('')
    setEndDate('')
    setModalAcclTZ('')
    setRestType('12h')
    setIsEdit(false)
    setEditEvent(null)
    setValidationMessage('')
    setMaxDutyResult('')
  }

  const formatTime = (time: string) => {
    if (!time) return ''
    if (timeFormat === '12h') {
      const [h, m] = time.split(':').map(Number)
      const period = h >= 12 ? 'PM' : 'AM'
      const hour = h % 12 || 12
      return `${hour}:${m.toString().padStart(2, '0')} ${period}`
    }
    return time
  }

  const getHourInTZ = (date: Date, tz: string) => {
    return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(date))
  }

  const getLocalTime = (time: string) => formatTime(time)
  const getZuluTime = (time: string, date: Date | null) => {
    if (!time || !date || isNaN(date.getTime())) return ''
    const d = new Date(date)
    const [h, m] = time.split(':').map(Number)
    d.setHours(h, m)
    return formatTime(d.toISOString().slice(11, 16))
  }

  const days = getCalendarDays(currentDate)

  const isInRange = (date: Date) => {
    if (!showAddDuty || !addDutyDate) return false
    const start = addDutyDate
    const end = endDate ? new Date(endDate) : start
    return date.getTime() >= start.getTime() && date.getTime() <= end.getTime()
  }

  return (
    <div className={`calendar ${darkMode ? 'dark' : 'light'} ${animating ? 'animating' : ''}`}>
      <div className="calendar-page-container">
        <h1>{currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h1>
        <header className="calendar-header">
          <h2>Calendar</h2>
          <div className="header-buttons">
            <button onClick={() => setShowSettings(true)}>⚙️</button>
            <button className="theme-toggle" onClick={() => {
              const newMode = !darkMode;
              setDarkMode(newMode);
              localStorage.setItem('theme', newMode ? 'dark' : 'light');
            }}>
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </header>
        <div className="calendar-container">
          <button className="nav-prev" onClick={() => {
            const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
            if (newDate >= minMonth) {
              setAnimating(true)
              setTimeout(() => setCurrentDate(newDate), 150)
              setTimeout(() => setAnimating(false), 300)
            }
          }}>
            ‹
          </button>
          <div className="calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="day-header">{day}</div>
            ))}
            {days.map((date: Date, index: number) => {
              const today = new Date()
              const isToday = date.toDateString() === today.toDateString()
              return (
                <div
                  key={index}
                  className={`day ${getDayStatus(date)} ${date.getMonth() !== currentDate.getMonth() ? 'other-month' : ''} ${selectedDate && selectedDate.toDateString() === date.toDateString() ? 'selected' : ''} ${isInRange(date) ? 'in-range' : ''} ${isToday ? 'today' : ''}`}
                  onMouseDown={() => handleMouseDown(date)}
                  onMouseUp={handleMouseUp}
                  onTouchStart={() => handleMouseDown(date)}
                  onTouchEnd={handleMouseUp}
                  onClick={() => handleClick(date)}
                >
                  <span className="day-number">{date.getDate()}</span>
                  {renderEventBars(date)}
                </div>
              )
            })}
          </div>
          <button className="nav-next" onClick={() => {
            const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
            if (newDate <= maxMonth) {
              setAnimating(true)
              setTimeout(() => setCurrentDate(newDate), 150)
              setTimeout(() => setAnimating(false), 300)
            }
          }}>
            ›
          </button>
        </div>
        {selectedDate && (
          <div className="day-details">
            <h3>{selectedDate.toDateString()}</h3>
            <p>Events: {events.filter(e => e.start.toDateString() === selectedDate.toDateString()).map(e => e.title).join(', ')}</p>
            <div className="actions">
              {getDayActions(selectedDate).map(action => (
                <button key={action} onClick={
                  action === 'Add Duty' ? handleAddDuty :
                  action === 'Edit Duty' ? handleEditDuty :
                  action === 'Delete Duty' ? handleDeleteDuty :
                  () => alert(action)
                }>{action}</button>
              ))}
            </div>
            <button onClick={() => setSelectedDate(null)}>Close</button>
          </div>
        )}

        {showMenu && menuDate && (
          <div className="modal">
            <div className="modal-content">
              <h3>Options for {menuDate.toDateString()}</h3>
              <button onClick={handleAddDuty}>Add Duty</button>
              <button onClick={() => setShowMenu(false)}>Cancel</button>
            </div>
          </div>
        )}

        {showAddDuty && addDutyDate && (
          <div className={`slide-menu ${showAddDuty ? 'open' : ''}`}>
            <h3>{isEdit ? 'Edit Duty' : 'Add Duty'} for {addDutyDate?.toDateString()}</h3>
            <label>
              Start Time:
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              Local: {getLocalTime(startTime)} | Zulu: {getZuluTime(startTime, addDutyDate)}
            </label>
            <label>
              End Date:
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
            <label>
              End Time:
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              Local: {getLocalTime(endTime)} | Zulu: {getZuluTime(endTime, endDate ? new Date(endDate) : null)}
            </label>
            <label>
              Number of Sectors:
              <input type="number" min="1" value={sectors} onChange={(e) => { setSectors(Number(e.target.value)); localStorage.setItem('lastSectors', e.target.value) }} />
            </label>
            <label>
              Average Sector Time:
              <select value={avgSectorTime} onChange={(e) => { setAvgSectorTime(e.target.value as '<30' | '30-50' | '>=50'); localStorage.setItem('lastAvgSectorTime', e.target.value) }}>
                <option value="<30">Less than 30 min</option>
                <option value="30-50">30 to less than 50 min</option>
                <option value=">=50">50 min or more</option>
              </select>
            </label>
            <label>
              Acclimatization Time Zone:
              <TimeZoneSelector 
                value={modalAcclTZ} 
                onChange={setModalAcclTZ} 
                placeholder="Search time zones or use global setting"
                allowEmpty={true}
              />
            </label>
            <label>
              Rest Type:
              <select value={restType} onChange={(e) => setRestType(e.target.value as '12h' | '10+travel')}>
                <option value="12h">12 hours rest</option>
                <option value="10+travel">10+travel (10 hours at hotel + room key)</option>
              </select>
            </label>
            <button onClick={() => { 
              const start = new Date(addDutyDate.toDateString() + ' ' + startTime); 
              const acclimatizedStartHour = getHourInTZ(start, modalAcclTZ || acclTZ);
              const max = regulator === 'TC' ? getMaxDutyFromTable(acclimatizedStartHour, sectors, avgSectorTime) : regulator === 'EASA' ? 13 : 14; 
              setMaxDutyResult(`Max FDP: ${max} hours (${regulator === 'TC' ? 'CAR 705' : regulator})`)
            }}>Check Max Duty</button>
            {maxDutyResult && <div className="max-duty-result">{maxDutyResult}</div>}
            <button onClick={handleSubmitDuty}>{isEdit ? 'Update' : 'Add'}</button>
            {validationMessage && <div className="validation-error">{validationMessage}</div>}
            <button onClick={() => {
              setShowAddDuty(false)
              setStartTime('')
              setEndTime('')
              setEndDate('')
              setModalAcclTZ('')
              setRestType('12h')
              setIsEdit(false)
              setEditEvent(null)
              setValidationMessage('')
              setMaxDutyResult('')
            }}>Cancel</button>
          </div>
        )}

        {showSettings && (
          <div className={`slide-menu ${showSettings ? 'open' : ''}`}>
            <h3>Settings</h3>
            <label>Time Format: <select value={timeFormat} onChange={(e) => { setTimeFormat(e.target.value as '24h' | '12h'); localStorage.setItem('timeFormat', e.target.value) }}><option value="24h">24H</option><option value="12h">12H (AM/PM)</option></select></label>
            <label>Regulator: <select value={regulator} onChange={(e) => { setRegulator(e.target.value as 'TC' | 'FAA' | 'EASA' | 'Australia'); localStorage.setItem('regulator', e.target.value) }}><option value="TC">CAR 705 (Canada)</option><option value="FAA">FAA (USA)</option><option value="EASA">EASA (Europe)</option><option value="Australia">CASA (Australia)</option></select></label>
            <label>Reference Time Zone: <TimeZoneSelector value={referenceTZ} onChange={(value) => { setReferenceTZ(value); localStorage.setItem('referenceTZ', value) }} /></label>
            <label>Acclimatization Time Zone: <TimeZoneSelector value={acclTZ} onChange={(value) => { setAcclTZ(value); localStorage.setItem('lastAcclTZ', value) }} /></label>
            <button onClick={() => setShowSettings(false)}>Close</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Calendar
