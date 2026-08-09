export function generateOtp(length = 6) {
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += Math.floor(Math.random() * 10);
    }
    return otp;
}

export function verifyOtp(otp, expectedOtp) {
    if (otp === expectedOtp) {
        return true;
    } else {
        return false;
    }
}