let socket;

if (typeof window !== 'undefined') {
    socket = new WebSocket('ws://192.168.100.101:5000');
}

export default socket;
