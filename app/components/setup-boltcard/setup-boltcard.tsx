import React, {useEffect, useState, useRef} from 'react';
import {View, StyleSheet, Text, ActivityIndicator, TouchableOpacity, Share, Clipboard} from 'react-native';
import NfcManager, {Ndef, NfcTech} from 'react-native-nfc-manager';
import {Button} from 'react-native-elements';
import {Icon} from 'react-native-elements'
import Ntag424 from '../../utils/Ntag424';
import QRCode from 'react-native-qrcode-svg';
import {useMutation} from '@apollo/client';
import {BOLT_CARD_GENERATE_OTP_MUTATION} from '../../graphql/query';
import {translate} from '../../i18n';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/stack-param-lists';

const SetupStep = {
  Init: 1,
  HoldCard: 2,
  WritingCard: 3,
  Success: 4,
  Error: 5,
  ExternalSetup: 6,
};

interface SetupBoltcardProps {
  cardKeys?: {
    K0: string;
    K1: string;
    K2: string;
    K3: string;
    K4: string;
    LNURLW: string;
  };
  initialCardUID?: string;
  startCardProgramming?: boolean;
  cardId?: string;
}

const SetupBoltcard: React.FC<SetupBoltcardProps> = ({
  cardKeys,
  initialCardUID,
  startCardProgramming = false,
  cardId,
}) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [step, setStep] = useState(SetupStep.Init);
  const [error, setError] = useState('');
  const [writingCard, setWritingCard] = useState(false);
  const [ndefWritten, setNdefWritten] = useState(false);
  const [key0Changed, setKey0Changed] = useState(false);
  const [key1Changed, setKey1Changed] = useState(false);
  const [key2Changed, setKey2Changed] = useState(false);
  const [key3Changed, setKey3Changed] = useState(false);
  const [key4Changed, setKey4Changed] = useState(false);
  const [writeKeys, setWriteKeys] = useState('');
  const [testBolt, setTestBolt] = useState('');
  const [externalSetupUrl, setExternalSetupUrl] = useState('');
  const [isGeneratingUrl, setIsGeneratingUrl] = useState(false);
  const isProgramming = useRef(false);
  
  const [generateOTP] = useMutation(BOLT_CARD_GENERATE_OTP_MUTATION);

  // Clean up NFC when component unmounts
  useEffect(() => {
    return () => {
      NfcManager.cancelTechnologyRequest();
    };
  }, []);

  // Start card programming when startCardProgramming prop changes to true
  useEffect(() => {
    if (startCardProgramming && cardKeys && initialCardUID && !isProgramming.current) {
      console.log("Starting card programming with keys and UID:", initialCardUID);
      isProgramming.current = true;
      programCard();
    }
  }, [startCardProgramming, cardKeys, initialCardUID]);

  const reset = () => {
    setError('');
    setWritingCard(false);
    setNdefWritten(false);
    setKey0Changed(false);
    setKey1Changed(false);
    setKey2Changed(false);
    setKey3Changed(false);
    setKey4Changed(false);
    setWriteKeys('');
    setTestBolt('');
    NfcManager.cancelTechnologyRequest();
  };

  const generateExternalSetupUrl = async () => {
    if (!cardId) {
      setError('Card ID is required to generate external setup URL');
      return;
    }

    try {
      setIsGeneratingUrl(true);
      
      // Generate a new OTP for external setup
      const otpResponse = await generateOTP({
        variables: {
          input: {
            cardId,
          },
        },
      });
      
      if (otpResponse.data.boltCardGenerateOtp.errors?.length > 0) {
        throw new Error(otpResponse.data.boltCardGenerateOtp.errors[0].message);
      }
      
      const otp = otpResponse.data.boltCardGenerateOtp.otp;
      
      // Create the external setup URL
      const url = `https://pay.bitcoinjungle.app/api/bolt-card/${otp}`;
      setExternalSetupUrl(url);
      setStep(SetupStep.ExternalSetup);
    } catch (err) {
      console.error('Error generating external setup URL:', err);
      setError('Failed to generate external setup URL: ' + err.message);
    } finally {
      setIsGeneratingUrl(false);
    }
  };

  const shareUrl = async () => {
    try {
      await Share.share({
        message: externalSetupUrl,
      });
    } catch (error) {
      console.error('Error sharing URL:', error);
    }
  };

  const copyUrl = () => {
    Clipboard.setString(externalSetupUrl);
  };

  const programCard = async () => {
    if (!cardKeys || !initialCardUID) {
      console.log("Cannot program card: missing keys or UID");
      setError('Missing card keys or UID');
      setStep(SetupStep.Error);
      return;
    }

    reset();
    setStep(SetupStep.HoldCard);

    try {
      console.log("Programming card with UID:", initialCardUID, "and keys");
      
      const {K0, K1, K2, K3, K4, LNURLW: lnurlw_base} = cardKeys;
      if (!K0 || !K1 || !K2 || !K3 || !K4 || !lnurlw_base) {
        throw new Error('Missing required keys for card setup');
      }

      await NfcManager.start();

      // Prepare NDEF message
      const ndefMessage = lnurlw_base.includes('?')
        ? lnurlw_base + '&p=00000000000000000000000000000000&c=0000000000000000'
        : lnurlw_base + '?p=00000000000000000000000000000000&c=0000000000000000';
      console.log("NDEF message:", ndefMessage);

      // Check if NFC is available
      const isNfcSupported = await Ntag424.isSupported();
      if (!isNfcSupported) {
        throw new Error('NFC is not supported on this device');
      }
      
      // Ensure NFC is enabled
      const isEnabled = await Ntag424.isEnabled();
      if (!isEnabled) {
        throw new Error('NFC is not enabled on this device');
      }

      console.log("NFC is supported and enabled, requesting technology...");
      // Request NFC technology
      await Ntag424.requestTechnology(NfcTech.IsoDep, {
        alertMessage: 'Hold your card to the phone until programming is complete.',
      });
      
      setStep(SetupStep.WritingCard);
      setWritingCard(true);

      // Create NDEF message
      const message = [Ndef.uriRecord(ndefMessage)];
      const bytes = Ndef.encodeMessage(message);
      
      try {
        console.log("Attempting to write NDEF message...");
        await Ntag424.setNdefMessage(bytes);
        setNdefWritten(true);
        console.log("NDEF message written successfully");
      } catch (ndefError) {
        console.error("Error writing NDEF message:", ndefError);
        throw new Error(`Failed to write NDEF message: ${ndefError.message || ndefError}`);
      }

      // Change card settings and keys
      const key0 = '00000000000000000000000000000000';
      try {
        console.log("Authenticating with default key...");
        await Ntag424.AuthEv2First('00', key0);
        console.log("Authentication successful");
      } catch (authError) {
        console.error("Authentication error:", authError);
        throw new Error(`Authentication failed: ${authError.message || authError}`);
      }
      
      const piccOffset = ndefMessage.indexOf('p=') + 9;
      const macOffset = ndefMessage.indexOf('c=') + 9;
      
      // Change file settings
      try {
        console.log("Setting BoltCard file settings...");
        await Ntag424.setBoltCardFileSettings(piccOffset, macOffset);
        console.log("File settings changed successfully");
      } catch (settingsError) {
        console.error("Error changing file settings:", settingsError);
        throw new Error(`Failed to change file settings: ${settingsError.message || settingsError}`);
      }
      
      // Change keys
      try {
        console.log('Changing key 1');
        await Ntag424.changeKey('01', key0, K1, '01');
        setKey1Changed(true);
        
        console.log('Changing key 2');
        await Ntag424.changeKey('02', key0, K2, '01');
        setKey2Changed(true);
        
        console.log('Changing key 3');
        await Ntag424.changeKey('03', key0, K3, '01');
        setKey3Changed(true);
        
        console.log('Changing key 4');
        await Ntag424.changeKey('04', key0, K4, '01');
        setKey4Changed(true);
        
        console.log('Changing key 0');
        await Ntag424.changeKey('00', key0, K0, '01');
        setKey0Changed(true);
        
        setWriteKeys('success');
        console.log("All keys changed successfully");
      } catch (keyError) {
        console.error("Error changing keys:", keyError);
        throw new Error(`Failed to change keys: ${keyError.message || keyError}`);
      }

      // Test LNURL
      const httpsLNURL = String(ndefMessage.replace('lnurlw://', 'https://')).trim();
      try {
        const response = await fetch(httpsLNURL);
        if (response.ok) {
          setTestBolt('success');
          console.log("LNURL test successful");
        } else {
          setTestBolt('Error: ' + response.statusText);
          console.log("LNURL test failed:", response.statusText);
        }
      } catch (error) {
        setTestBolt('Error: ' + error.message);
        console.log("LNURL test error:", error.message);
      }

      setStep(SetupStep.Success);
      console.log("Card programming completed successfully");
    } catch (ex) {
      console.error('Card programming error:', ex);
      let errorMessage = ex;
      if (typeof ex === 'object') {
        errorMessage = ex.message ? ex.message : ex.constructor.name;
      }
      
      if (
        errorMessage == 'You can only issue one request at a time' ||
        errorMessage == 'UserCancel' ||
        errorMessage == 'Duplicated registration'
      ) {
        reset();
        return;
      }
      
      setError('NFC Error: ' + errorMessage);
      setStep(SetupStep.Error);
    } finally {
      setWritingCard(false);
      NfcManager.cancelTechnologyRequest();
      isProgramming.current = false;
    }
  };

  const renderStep = () => {
    switch (step) {
      case SetupStep.Init:
        return (
          <View style={styles.container}>
            <View style={styles.optionsContainer}>
              <View style={styles.optionCard}>
                <Icon name="phone-portrait" type="ionicon" size={40} color="#2089dc" style={styles.optionIcon} />
                <Text style={styles.optionTitle}>{translate('BoltCardScreen.programCardThisDevice')}</Text>
                <Text style={styles.optionDescription}>
                  {translate('BoltCardScreen.programCardDescriptionThisDevice')}
                </Text>
                <Button
                  title={translate('BoltCardScreen.programCard')}
                  onPress={programCard}
                  buttonStyle={styles.button}
                  icon={<Icon name="flash" type="ionicon" size={20} color="white" style={{marginRight: 10}} />}
                />
              </View>
              
              <View style={styles.optionCard}>
                <Icon name="link" size={40} color="#2089dc" style={styles.optionIcon} />
                <Text style={styles.optionTitle}>{translate('BoltCardScreen.getSetupUrl')}</Text>
                <Text style={styles.optionDescription}>
                  {translate('BoltCardScreen.programCardOtherDevice')}
                </Text>
                <Button
                  title={isGeneratingUrl ? translate('BoltCardScreen.generating') : translate('BoltCardScreen.getSetupUrl')}
                  onPress={generateExternalSetupUrl}
                  buttonStyle={styles.button}
                  loading={isGeneratingUrl}
                  disabled={isGeneratingUrl}
                  icon={<Icon name="qr-code" size={20} color="white" style={{marginRight: 10}} />}
                />
              </View>
            </View>
          </View>
        );
      case SetupStep.HoldCard:
        return (
          <View style={styles.container}>
            <Text style={styles.title}>{translate('BoltCardScreen.holdCardToPhone')}</Text>
            <Text style={styles.description}>
              {translate('BoltCardScreen.holdCardToPhoneDescription')}
            </Text>
            <ActivityIndicator size="large" color="#0000ff" />
          </View>
        );
      case SetupStep.WritingCard:
        return (
          <View style={styles.container}>
            <Text style={styles.title}>{translate('BoltCardScreen.programmingCard')}</Text>
            <Text style={styles.description}>
              {translate('BoltCardScreen.programmingCardDescription')}
            </Text>
            <View style={styles.statusContainer}>
              <Text style={styles.statusItem}>
                NDEF Written: {ndefWritten ? '✅' : '⏳'}
              </Text>
              <Text style={styles.statusItem}>
                Key 0 Changed: {key0Changed ? '✅' : '⏳'}
              </Text>
              <Text style={styles.statusItem}>
                Key 1 Changed: {key1Changed ? '✅' : '⏳'}
              </Text>
              <Text style={styles.statusItem}>
                Key 2 Changed: {key2Changed ? '✅' : '⏳'}
              </Text>
              <Text style={styles.statusItem}>
                Key 3 Changed: {key3Changed ? '✅' : '⏳'}
              </Text>
              <Text style={styles.statusItem}>
                Key 4 Changed: {key4Changed ? '✅' : '⏳'}
              </Text>
            </View>
            <ActivityIndicator size="large" color="#0000ff" />
          </View>
        );
      case SetupStep.Success:
        return (
          <View style={styles.container}>
            <Text style={styles.title}>{translate('BoltCardScreen.cardProgrammingComplete')}</Text>
            <Text style={styles.description}>
              {translate('BoltCardScreen.cardProgrammingCompleteDescription')}
            </Text>
            <Button
              title={translate('BoltCardScreen.done')}
              onPress={() => navigation.navigate('boltCards')}
              buttonStyle={styles.button}
            />
          </View>
        );
      case SetupStep.ExternalSetup:
        return (
          <View style={styles.container}>
            <Text style={styles.title}>{translate('BoltCardScreen.externalSetupUrl')}</Text>
            <Text style={styles.description}>
              {translate('BoltCardScreen.externalSetupUrlDescription')}
              {translate('BoltCardScreen.externalSetupUrlDescription2')}
            </Text>
            
            <View style={styles.qrContainer}>
              <QRCode
                size={200}
                value={externalSetupUrl}
                logoBackgroundColor="white"
                ecl={"H"}
              />
            </View>
            
            <Text style={styles.urlText}>{externalSetupUrl}</Text>
            
            <View style={styles.buttonRow}>
              <Button
                title="Copy URL"
                onPress={copyUrl}
                buttonStyle={[styles.button, styles.buttonSmall]}
                icon={<Icon name="copy" type="ionicon" size={20} color="white" style={{marginRight: 10}} />}
              />
              <Button
                title="Share URL"
                onPress={shareUrl}
                buttonStyle={[styles.button, styles.buttonSmall]}
                icon={<Icon name="share" size={20} color="white" style={{marginRight: 10}} />}
              />
            </View>
          </View>
        );
      case SetupStep.Error:
        return (
          <View style={styles.container}>
            <Text style={styles.title}>{translate('common.error')}</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Button
              title={translate('common.tryAgain')}
              onPress={() => {
                reset();
                setStep(SetupStep.Init);
              }}
              buttonStyle={styles.button}
            />
          </View>
        );
      default:
        return null;
    }
  };

  return <View style={styles.mainContainer}>{renderStep()}</View>;
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    padding: 10,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 10,
    paddingRight: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginVertical: 10,
  },
  spinner: {
    marginVertical: 20,
  },
  progressContainer: {
    marginTop: 20,
    alignItems: 'flex-start',
    width: '100%',
    maxWidth: 300,
  },
  progressText: {
    fontSize: 14,
    marginVertical: 5,
  },
  button: {
    backgroundColor: '#2089dc',
    borderRadius: 5,
    marginTop: 20,
    paddingHorizontal: 30,
  },
  buttonSmall: {
    marginHorizontal: 5,
  },
  statusContainer: {
    marginTop: 20,
    alignItems: 'flex-start',
    width: '100%',
    maxWidth: 300,
  },
  statusItem: {
    fontSize: 14,
    marginVertical: 5,
  },
  optionsContainer: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    width: '100%',
  },
  optionCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 20,
    marginVertical: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  optionIcon: {
    marginBottom: 10,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  optionDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
    color: '#666',
  },
  qrContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginVertical: 15,
  },
  urlText: {
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 15,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});

export default SetupBoltcard; 