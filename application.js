var LedController = require('./controllers/sensors/led')
var ButtonController = require('./controllers/sensors/button')
var CapacitiveController = require('./controllers/sensors//capacitive')
var USonicController = require('./controllers/sensors/usonic')

const LEDS_PINS = [2, 3, 4]
const BUTTONS_PINS = [17, 27, 22]
const CAPACITIVE_PINS = [16]
const USONIC_PINS = [{ echo: 21, trig: 20 }]

const BUTTON_ACTIVATED_EVENT = "ButtonSensorWasActivatedEvent"
const BUTTON_DISABLED_EVENT = "ButtonSensorWasDisabledEvent"
const CAPACITIVE_ACTIVATED_EVENT = "CapacitiveSensorActivatedEvent"
const CAPACITIVE_DISABLED_EVENT = "CapacitiveSensorDisabledEvent"
const USONIC_CHANGE_EVENT = "USonicSensorChangeEvent"
const RESET_EVENT = "ResetEvent"

class Application {

	constructor() {
		this.clientSockets = []
		this.activeLedsPins = []
		this.activeCapacitivesPins = []
		this.distancesUSonic = []

		this.ledController = new LedController(LEDS_PINS)
		this.buttonController = new ButtonController(BUTTONS_PINS)
		this.capativiceController = new CapacitiveController(CAPACITIVE_PINS)

		this.buttonController.observeChanges(this.didReciveNewButtonState.bind(this))
		this.capativiceController.observeChanges(this.didReceiveNewCapacitiveState.bind(this))

		this.uSonicController = new USonicController(USONIC_PINS, function() {
			this.uSonicController.observeChanges(this.didReciveUSonicNewDistance.bind(this))
		}.bind(this))
	}

	handleNewConnection(wsc) {
		this.clientSockets.push(wsc)

		console.log('New WebSocket client connected')
	}

	handleDisconnection(wsc) {
		this.clientSockets = this.clientSockets.filter(client => client.uuid != wsc.uuid)

		console.log('One WebSocket client was disconnected')
	}

	hangleMensageIncoming(wsc, message) {

  		const data = JSON.parse(message)

  		if (data.event == RESET_EVENT) {
  			this.ledController.reset()
  			this.activeLedsPins = []
  			this.activeCapacitivesPins = []
			this.distancesUSonic = []
  		}
	}

	broadcastButtonActivedEvent(id) {
		const data = {
			event: BUTTON_ACTIVATED_EVENT,
			id: id
		}

		this.broadcastData(data)
	}

	broadcastButtonDisabledEvent(id) {
		const data = {
			event: BUTTON_DISABLED_EVENT,
			id: id
		}

		this.broadcastData(data)
	}

	broadcastCapacitiveActivedEvent(id) {
		const data = {
			event: CAPACITIVE_ACTIVATED_EVENT,
			id: id
		}

		this.broadcastData(data)
	}

	broadcastCapacitiveDisabledEvent(id) {
		const data = {
			event: CAPACITIVE_DISABLED_EVENT,
			id: id
		}

		this.broadcastData(data)
	}

	broadcastUSonicChangedDistanceEvent(distance) {
		const data = {
			event: USONIC_CHANGE_EVENT,
			distance: distance
		}

		this.broadcastData(data)
	}

	broadcastData(data) {
		const message = JSON.stringify(data)
		this.clientSockets.forEach(function(cs) {
			cs.send(message)
		})
	}

	didReciveNewButtonState(pin, value) {
		const buttonIndex = BUTTONS_PINS.indexOf(pin)
		const ledPinForButton = LEDS_PINS[buttonIndex]

		const index = this.activeLedsPins.indexOf(ledPinForButton)

		if (index == -1) {
			this.ledController.setValue(ledPinForButton, 1)
			this.broadcastButtonActivedEvent(buttonIndex + 1)
			this.activeLedsPins.push(ledPinForButton)
		} else {
			this.ledController.setValue(ledPinForButton, 0)
			this.broadcastButtonDisabledEvent(buttonIndex + 1)
			this.activeLedsPins.splice(index, 1)
		}
	}

	didReceiveNewCapacitiveState(pin, value) {
		const index = this.activeCapacitivesPins.indexOf(pin)

		if (index == -1) {
			this.broadcastCapacitiveActivedEvent(index + 1)
			this.activeCapacitivesPins.push(pin)
		} else {
			this.broadcastCapacitiveDisabledEvent(index + 1)
			this.activeCapacitivesPins.splice(index, 1)
		}
	}

	didReciveUSonicNewDistance(pin, value) {
		let distance = -1
		if ((value >= 8) && (value <= 12))
			distance = 1
		else if ((value >= 18) && (value <= 22))
			distance = 2
		else if ((value >= 28) && (value <= 32))
			distance = 3

		if (distance > 0) {
			let currentDate = new Date()
			let didSendRecently = this.distancesUSonic.filter(d => {
				if (d.distance != distance)
					return false

				let secondsDiff = Math.abs((currentDate.getTime() - d.date.getTime())/1000)
				if (secondsDiff > 3)
					return false

				return true
			}).length > 0

			if (!didSendRecently) {
				this.broadcastUSonicChangedDistanceEvent(distance)

				this.distancesUSonic.push({
					distance: distance,
					date: new Date()
				})
			}
		}
	}
}

module.exports = Application