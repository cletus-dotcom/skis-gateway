import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Linking from 'expo-linking';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const VERIFIER_EMAIL = 'cletusacaido@gmail.com';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://ohkdmmnjbmfynvjrrtsw.supabase.co';

type Step = 'form' | 'qr' | 'reference' | 'success';

interface CompanyDetails {
  companyName: string;
  address: string;
  representativeName: string;
  email: string;
  contactNumber: string;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('form');
  const [amount, setAmount] = useState('');
  const [details, setDetails] = useState<CompanyDetails>({
    companyName: '',
    address: '',
    representativeName: '',
    email: '',
    contactNumber: '',
  });
  const [referenceNumber, setReferenceNumber] = useState('');
  const [sending, setSending] = useState(false);

  // Read amount from URL when app is opened via link (e.g. skisgateway://pay?amount=1500)
  useEffect(() => {
    const handleUrl = (url: string) => {
      const parsed = Linking.parse(url);
      const amountParam = parsed.queryParams?.amount ?? parsed.queryParams?.amt;
      if (amountParam && typeof amountParam === 'string') {
        setAmount(amountParam.trim());
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  const updateDetail = (key: keyof CompanyDetails, value: string) => {
    setDetails((prev) => ({ ...prev, [key]: value }));
  };

  const validateForm = (): boolean => {
    if (!details.companyName.trim()) {
      Alert.alert('Required', 'Please enter the company name.');
      return false;
    }
    if (!details.address.trim()) {
      Alert.alert('Required', 'Please enter the address.');
      return false;
    }
    if (!details.representativeName.trim()) {
      Alert.alert('Required', 'Please enter the name of representative.');
      return false;
    }
    if (!details.email.trim()) {
      Alert.alert('Required', 'Please enter the email address.');
      return false;
    }
    if (!details.contactNumber.trim()) {
      Alert.alert('Required', 'Please enter the contact number.');
      return false;
    }
    const amt = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount (can be set via link or manually).');
      return false;
    }
    return true;
  };

  const onShowQR = () => {
    if (!validateForm()) return;
    setStep('qr');
  };

  const onSubmitReference = async () => {
    const ref = referenceNumber.trim();
    if (!ref) {
      Alert.alert('Required', 'Please enter the GCash/QR Ph reference number.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-verification-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: details.companyName,
          address: details.address,
          representativeName: details.representativeName,
          email: details.email,
          contactNumber: details.contactNumber,
          amount,
          referenceNumber: ref,
          verifierEmail: VERIFIER_EMAIL,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `Request failed: ${res.status}`);
      }
      setStep('success');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to send verification. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setSending(false);
    }
  };

  const paddingTop = insets.top + 16;
  const paddingBottom = insets.bottom + 16;

  if (step === 'form') {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop, paddingBottom }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.header}>SKIS Gateway</Text>
          <Text style={styles.subheader}>App Registration / Subscription Renewal</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Name of company</Text>
            <TextInput
              style={styles.input}
              value={details.companyName}
              onChangeText={(v) => updateDetail('companyName', v)}
              placeholder="e.g. Acme Corp"
              placeholderTextColor="#64748b"
              autoCapitalize="words"
            />
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={details.address}
              onChangeText={(v) => updateDetail('address', v)}
              placeholder="Full address"
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={2}
            />
            <Text style={styles.label}>Name of representative</Text>
            <TextInput
              style={styles.input}
              value={details.representativeName}
              onChangeText={(v) => updateDetail('representativeName', v)}
              placeholder="Full name"
              placeholderTextColor="#64748b"
              autoCapitalize="words"
            />
            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              value={details.email}
              onChangeText={(v) => updateDetail('email', v)}
              placeholder="email@company.com"
              placeholderTextColor="#64748b"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.label}>Contact number</Text>
            <TextInput
              style={styles.input}
              value={details.contactNumber}
              onChangeText={(v) => updateDetail('contactNumber', v)}
              placeholder="e.g. 09XX XXX XXXX"
              placeholderTextColor="#64748b"
              keyboardType="phone-pad"
            />
            <Text style={styles.label}>Amount (PHP)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="Enter amount or open via link with ?amount=..."
              placeholderTextColor="#64748b"
              keyboardType="decimal-pad"
            />

            <TouchableOpacity style={styles.primaryButton} onPress={onShowQR} activeOpacity={0.8}>
              <Text style={styles.primaryButtonText}>Submit & Show GCash QR</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (step === 'qr') {
    const qrPayload = JSON.stringify({
      type: 'skis_gateway',
      amount,
      company: details.companyName,
      rep: details.representativeName,
    });
    return (
      <ScrollView
        style={[styles.container, { paddingTop, paddingBottom }]}
        contentContainerStyle={styles.qrContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.header}>SKIS Gateway</Text>
        <Text style={styles.amountLabel}>Amount to pay</Text>
        <Text style={styles.amountValue}>₱ {Number(amount.replace(/,/g, '')).toLocaleString('en-PH')}</Text>
        <View style={styles.qrBox}>
          <QRCode value={qrPayload} size={220} backgroundColor="#fff" color="#0f172a" />
        </View>
        <Text style={styles.qrHint}>Scan this QR with GCash or QR Ph to pay</Text>
        <Text style={styles.stepNote}>After payment, you will need to send your reference number for verification.</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep('reference')} activeOpacity={0.8}>
          <Text style={styles.secondaryButtonText}>I've paid — Enter reference number</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.textButton} onPress={() => setStep('form')}>
          <Text style={styles.textButtonText}>Back to form</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (step === 'reference') {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop, paddingBottom }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={20}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.header}>SKIS Gateway</Text>
          <Text style={styles.subheader}>Payment verification</Text>
          <Text style={styles.referenceHint}>
            Enter your GCash or QR Ph reference number. We will send it to the verifier ({VERIFIER_EMAIL}) so they can confirm your payment and email you back.
          </Text>
          <TextInput
            style={styles.input}
            value={referenceNumber}
            onChangeText={setReferenceNumber}
            placeholder="Reference number"
            placeholderTextColor="#64748b"
            autoCapitalize="characters"
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.primaryButton, sending && styles.buttonDisabled]}
            onPress={onSubmitReference}
            disabled={sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Send for verification</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.textButton} onPress={() => setStep('qr')} disabled={sending}>
            <Text style={styles.textButtonText}>Back to QR code</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // step === 'success'
  return (
    <ScrollView
      style={[styles.container, { paddingTop, paddingBottom }]}
      contentContainerStyle={styles.successContainer}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.header}>SKIS Gateway</Text>
      <View style={styles.successCard}>
        <Text style={styles.successTitle}>Reference number sent</Text>
        <Text style={styles.successBody}>
          Your payment reference has been sent to the verifier at {VERIFIER_EMAIL}.
        </Text>
        <Text style={styles.stepsTitle}>What happens next:</Text>
        <Text style={styles.stepItem}>1. The verifier will confirm your payment using the reference number and company details.</Text>
        <Text style={styles.stepItem}>2. You will receive a confirmation email at {details.email} once verified.</Text>
        <Text style={styles.stepItem}>3. Keep your reference number for your records.</Text>
      </View>
      <TouchableOpacity style={styles.primaryButton} onPress={() => { setStep('form'); setReferenceNumber(''); }} activeOpacity={0.8}>
        <Text style={styles.primaryButtonText}>Start new registration</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 4,
  },
  subheader: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 28,
  },
  form: {
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#f8fafc',
    marginBottom: 8,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  secondaryButton: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#475569',
  },
  secondaryButtonText: {
    color: '#e2e8f0',
    fontSize: 17,
    fontWeight: '600',
  },
  textButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  textButtonText: {
    color: '#94a3b8',
    fontSize: 15,
  },
  qrContainer: {
    paddingHorizontal: 24,
    alignItems: 'center',
    paddingBottom: 40,
  },
  amountLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 24,
  },
  qrBox: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  qrHint: {
    fontSize: 15,
    color: '#cbd5e1',
    marginBottom: 8,
  },
  stepNote: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  referenceHint: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
    lineHeight: 22,
  },
  successContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  successCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#22c55e',
    marginBottom: 12,
  },
  successBody: {
    fontSize: 15,
    color: '#cbd5e1',
    lineHeight: 22,
    marginBottom: 16,
  },
  stepsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 8,
  },
  stepItem: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 22,
    marginBottom: 6,
  },
});
