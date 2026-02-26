// bitcoin-link-parser.ts
// 比特币和闪电网络链接解析器

/**
 * BIP21 Bitcoin URI 标准
 * 格式: bitcoin:<address>[?amount=<amount>][?label=<label>][?message=<message>][?lightning=<lightning_invoice>]
 */

/**
 * BOLT11 Lightning Invoice 标准
 * 格式: lightning:<invoice>
 */

// ==================== 类型定义 ====================

export interface BitcoinURIParams {
  amount?: number;           // BTC 金额（单位：BTC）
  label?: string;            // 付款标签
  message?: string;          // 付款消息
  lightning?: string;        // 闪电网络发票（可选）
  [key: string]: string | number | undefined; // 其他参数
}

export interface ParsedBitcoinURI {
  address: string;           // 比特币地址
  params: BitcoinURIParams;  // URI 参数
  rawURI: string;            // 原始 URI
}

export interface ParsedLightningInvoice {
  invoice: string;           // 原始发票字符串
  amount?: number;           // 金额（单位：satoshis）
  timestamp: number;         // 时间戳
  expiry: number;            // 过期时间（秒）
  description?: string;      // 付款描述
  paymentHash: string;       // 支付哈希
  network: 'mainnet' | 'testnet' | 'regtest'; // 网络类型
  rawInvoice: string;        // 原始发票
}

export interface PaymentRequest {
  type: 'bitcoin' | 'lightning';
  bitcoin?: ParsedBitcoinURI;
  lightning?: ParsedLightningInvoice;
  amount: number;            // 总金额（单位：satoshis）
  currency: 'BTC' | 'SAT';   // 货币单位
  description?: string;      // 付款描述
  timestamp: Date;           // 请求时间
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings: string[];
}

// ==================== 常量定义 ====================

const BITCOIN_URI_PREFIX = 'bitcoin:';
const LIGHTNING_URI_PREFIX = 'lightning:';
const BTC_TO_SAT = 100000000; // 1 BTC = 100,000,000 satoshis

// 支持的比特币地址前缀
const VALID_ADDRESS_PREFIXES = {
  mainnet: ['1', '3', 'bc1'],
  testnet: ['2', 'm', 'n', 'tb1'],
  regtest: ['2', 'm', 'n', 'bcrt1']
};

// ==================== 错误类定义 ====================

export class BitcoinLinkError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalURI?: string
  ) {
    super(message);
    this.name = 'BitcoinLinkError';
  }
}

export class LightningLinkError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalInvoice?: string
  ) {
    super(message);
    this.name = 'LightningLinkError';
  }
}

// ==================== 比特币 URI 解析器 ====================

/**
 * 比特币 URI 解析器（BIP21 标准）
 */
export class BitcoinURIParser {
  
  /**
   * 解析比特币 URI
   * @param uri 比特币 URI 字符串
   * @returns 解析后的比特币 URI 对象
   */
  static parse(uri: string): ParsedBitcoinURI {
    try {
      // 验证 URI 格式
      if (!uri.startsWith(BITCOIN_URI_PREFIX)) {
        throw new BitcoinLinkError(
          `Invalid Bitcoin URI prefix. Expected "${BITCOIN_URI_PREFIX}"`,
          'INVALID_PREFIX',
          uri
        );
      }

      // 移除前缀
      const uriWithoutPrefix = uri.slice(BITCOIN_URI_PREFIX.length);
      
      // 分割地址和参数
      const [addressPart, queryString] = uriWithoutPrefix.split('?');
      
      if (!addressPart) {
        throw new BitcoinLinkError(
          'Bitcoin address is missing',
          'MISSING_ADDRESS',
          uri
        );
      }

      // 解码地址（可能包含特殊字符）
      const address = decodeURIComponent(addressPart);
      
      // 验证地址格式
      this.validateAddress(address);

      // 解析查询参数
      const params: BitcoinURIParams = {};
      if (queryString) {
        const queryParams = new URLSearchParams(queryString);
        
        for (const [key, value] of queryParams.entries()) {
          const decodedValue = decodeURIComponent(value);
          
          switch (key) {
            case 'amount':
              const amount = parseFloat(decodedValue);
              if (isNaN(amount) || amount < 0) {
                throw new BitcoinLinkError(
                  'Invalid amount parameter',
                  'INVALID_AMOUNT',
                  uri
                );
              }
              params.amount = amount;
              break;
              
            case 'label':
            case 'message':
              params[key] = decodedValue;
              break;
              
            case 'lightning':
              params.lightning = decodedValue;
              break;
              
            default:
              // 存储其他参数
              params[key] = decodedValue;
          }
        }
      }

      return {
        address,
        params,
        rawURI: uri
      };
      
    } catch (error) {
      if (error instanceof BitcoinLinkError) {
        throw error;
      }
      throw new BitcoinLinkError(
        `Failed to parse Bitcoin URI: ${error.message}`,
        'PARSE_ERROR',
        uri
      );
    }
  }

  /**
   * 验证比特币地址
   * @param address 比特币地址
   */
  private static validateAddress(address: string): void {
    // 基本长度检查
    if (address.length < 26 || address.length > 90) {
      throw new BitcoinLinkError(
        'Invalid Bitcoin address length',
        'INVALID_ADDRESS_LENGTH',
        address
      );
    }

    // 检查地址前缀（简化验证，实际应用中应使用完整的地址验证库）
    const isValidPrefix = Object.values(VALID_ADDRESS_PREFIXES)
      .flat()
      .some(prefix => address.startsWith(prefix));

    if (!isValidPrefix) {
      throw new BitcoinLinkError(
        'Invalid Bitcoin address prefix',
        'INVALID_ADDRESS_PREFIX',
        address
      );
    }

    // 注意：完整的地址验证应该使用专门的比特币地址验证库
    // 这里只进行基本格式验证
  }

  /**
   * 验证比特币 URI
   * @param uri 比特币 URI
   * @returns 验证结果
   */
  static validate(uri: string): ValidationResult {
    const warnings: string[] = [];
    
    try {
      const parsed = this.parse(uri);
      
      // 检查金额是否过大（防止溢出攻击）
      if (parsed.params.amount && parsed.params.amount > 21000000) {
        warnings.push('Amount exceeds total Bitcoin supply');
      }
      
      // 检查标签长度
      if (parsed.params.label && parsed.params.label.length > 100) {
        warnings.push('Label is unusually long');
      }
      
      // 检查消息长度
      if (parsed.params.message && parsed.params.message.length > 500) {
        warnings.push('Message is unusually long');
      }
      
      // 如果包含闪电发票，验证它
      if (parsed.params.lightning) {
        try {
          LightningInvoiceParser.validate(parsed.params.lightning);
        } catch (error) {
          warnings.push(`Lightning invoice validation warning: ${error.message}`);
        }
      }
      
      return {
        isValid: true,
        warnings
      };
      
    } catch (error) {
      return {
        isValid: false,
        error: error.message,
        warnings
      };
    }
  }

  /**
   * 创建比特币 URI
   * @param address 比特币地址
   * @param params URI 参数
   * @returns 比特币 URI 字符串
   */
  static create(
    address: string,
    params?: BitcoinURIParams
  ): string {
    this.validateAddress(address);
    
    let uri = `${BITCOIN_URI_PREFIX}${encodeURIComponent(address)}`;
    
    if (params && Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, encodeURIComponent(value.toString()));
        }
      });
      
      uri += `?${queryParams.toString()}`;
    }
    
    return uri;
  }
}

// ==================== 闪电网络发票解析器 ====================

/**
 * 闪电网络发票解析器（BOLT11 标准）
 * 注意：这是一个简化的解析器，完整的 BOLT11 解析更复杂
 */
export class LightningInvoiceParser {
  
  /**
   * 解析闪电网络发票
   * @param invoice 闪电网络发票或 URI
   * @returns 解析后的发票对象
   */
  static parse(invoice: string): ParsedLightningInvoice {
    try {
      // 处理 lightning: 前缀
      let rawInvoice = invoice;
      if (invoice.startsWith(LIGHTNING_URI_PREFIX)) {
        rawInvoice = invoice.slice(LIGHTNING_URI_PREFIX.length);
      }
      
      // 基本验证
      if (!rawInvoice.startsWith('ln')) {
        throw new LightningLinkError(
          'Invalid Lightning invoice prefix',
          'INVALID_PREFIX',
          invoice
        );
      }
      
      // 分割发票字符串（简化解析）
      // 实际实现应该使用专门的 BOLT11 解析库
      const parts = rawInvoice.toLowerCase().split('1');
      
      if (parts.length < 2) {
        throw new LightningLinkError(
          'Invalid Lightning invoice format',
          'INVALID_FORMAT',
          invoice
        );
      }
      
      // 解析网络前缀
      const prefix = parts[0];
      let network: 'mainnet' | 'testnet' | 'regtest';
      
      switch (prefix) {
        case 'lnbc':
          network = 'mainnet';
          break;
        case 'lntb':
          network = 'testnet';
          break;
        case 'lnbcrt':
          network = 'regtest';
          break;
        default:
          throw new LightningLinkError(
            'Unsupported Lightning network',
            'UNSUPPORTED_NETWORK',
            invoice
          );
      }
      
      // 提取金额（如果存在）
      let amount: number | undefined;
      const amountMatch = rawInvoice.match(/ln\w+(\d+)/);
      if (amountMatch && amountMatch[1]) {
        amount = parseInt(amountMatch[1], 10);
      }
      
      // 这里应该添加完整的 BOLT11 解析逻辑
      // 由于 BOLT11 解析复杂，建议使用专门的库如 'bolt11'
      
      return {
        invoice: rawInvoice,
        amount,
        timestamp: Math.floor(Date.now() / 1000),
        expiry: 3600, // 默认1小时
        description: this.extractDescription(rawInvoice),
        paymentHash: this.extractPaymentHash(rawInvoice),
        network,
        rawInvoice: invoice
      };
      
    } catch (error) {
      if (error instanceof LightningLinkError) {
        throw error;
      }
      throw new LightningLinkError(
        `Failed to parse Lightning invoice: ${error.message}`,
        'PARSE_ERROR',
        invoice
      );
    }
  }

  /**
   * 提取付款描述（简化实现）
   */
  private static extractDescription(invoice: string): string {
    // 实际实现应该从 BOLT11 的 'd' 字段提取
    const match = invoice.match(/d=([^&]*)/);
    return match ? decodeURIComponent(match[1]) : 'Lightning payment';
  }

  /**
   * 提取支付哈希（简化实现）
   */
  private static extractPaymentHash(invoice: string): string {
    // 实际实现应该从 BOLT11 的 'p' 字段提取
    const match = invoice.match(/p=([a-f0-9]{64})/i);
    return match ? match[1] : 'unknown_hash';
  }

  /**
   * 验证闪电网络发票
   * @param invoice 闪电网络发票
   * @returns 验证结果
   */
  static validate(invoice: string): ValidationResult {
    const warnings: string[] = [];
    
    try {
      const parsed = this.parse(invoice);
      
      // 检查发票是否过期
      const currentTime = Math.floor(Date.now() / 1000);
      if (parsed.timestamp + parsed.expiry < currentTime) {
        return {
          isValid: false,
          error: 'Invoice has expired',
          warnings
        };
      }
      
      // 检查金额是否合理
      if (parsed.amount && parsed.amount > 100000000) { // 超过 1 BTC
        warnings.push('Invoice amount is unusually large');
      }
      
      // 检查描述长度
      if (parsed.description && parsed.description.length > 1000) {
        warnings.push('Invoice description is unusually long');
      }
      
      return {
        isValid: true,
        warnings
      };
      
    } catch (error) {
      return {
        isValid: false,
        error: error.message,
        warnings
      };
    }
  }
}

// ==================== 支付请求处理器 ====================

/**
 * 支付请求处理器
 */
export class PaymentRequestHandler {
  
  /**
   * 解析支付请求
   * @param uri 支付 URI
   * @returns 支付请求对象
   */
  static parsePaymentRequest(uri: string): PaymentRequest {
    try {
      // 检测 URI 类型
      if (uri.startsWith(BITCOIN_URI_PREFIX)) {
        return this.parseBitcoinPaymentRequest(uri);
      } else if (uri.startsWith(LIGHTNING_URI_PREFIX) || uri.startsWith('ln')) {
        return this.parseLightningPaymentRequest(uri);
      } else {
        throw new Error(`Unsupported payment URI scheme: ${uri.split(':')[0]}`);
      }
    } catch (error) {
      throw new Error(`Failed to parse payment request: ${error.message}`);
    }
  }

  /**
   * 解析比特币支付请求
   */
  private static parseBitcoinPaymentRequest(uri: string): PaymentRequest {
    const parsedBitcoin = BitcoinURIParser.parse(uri);
    
    // 计算总金额（单位：satoshis）
    const amountBTC = parsedBitcoin.params.amount || 0;
    const amountSats = Math.round(amountBTC * BTC_TO_SAT);
    
    // 如果有闪电发票，优先使用闪电支付
    if (parsedBitcoin.params.lightning) {
      try {
        const parsedLightning = LightningInvoiceParser.parse(parsedBitcoin.params.lightning);
        const lightningAmount = parsedLightning.amount || 0;
        
        return {
          type: 'lightning',
          bitcoin: parsedBitcoin,
          lightning: parsedLightning,
          amount: lightningAmount,
          currency: 'SAT',
          description: parsedBitcoin.params.label || parsedBitcoin.params.message,
          timestamp: new Date()
        };
      } catch (error) {
        // 如果闪电发票解析失败，回退到比特币支付
        console.warn('Failed to parse lightning invoice, falling back to bitcoin:', error.message);
      }
    }
    
    return {
      type: 'bitcoin',
      bitcoin: parsedBitcoin,
      amount: amountSats,
      currency: amountSats > 0 ? 'SAT' : 'BTC',
      description: parsedBitcoin.params.label || parsedBitcoin.params.message,
      timestamp: new Date()
    };
  }

  /**
   * 解析闪电网络支付请求
   */
  private static parseLightningPaymentRequest(uri: string): PaymentRequest {
    const parsedLightning = LightningInvoiceParser.parse(uri);
    
    return {
      type: 'lightning',
      lightning: parsedLightning,
      amount: parsedLightning.amount || 0,
      currency: 'SAT',
      description: parsedLightning.description,
      timestamp: new Date()
    };
  }

  /**
   * 验证支付请求
   * @param paymentRequest 支付请求
   * @returns 验证结果
   */
  static validatePaymentRequest(paymentRequest: PaymentRequest): ValidationResult {
    const warnings: string[] = [];
    
    try {
      if (paymentRequest.type === 'bitcoin' && paymentRequest.bitcoin) {
        const bitcoinValidation = BitcoinURIParser.validate(paymentRequest.bitcoin.rawURI);
        if (!bitcoinValidation.isValid) {
          return bitcoinValidation;
        }
        warnings.push(...bitcoinValidation.warnings);
      } else if (paymentRequest.type === 'lightning' && paymentRequest.lightning) {
        const lightningValidation = LightningInvoiceParser.validate(paymentRequest.lightning.rawInvoice);
        if (!lightningValidation.isValid) {
          return lightningValidation;
        }
        warnings.push(...lightningValidation.warnings);
      }
      
      // 检查金额是否合理
      if (paymentRequest.amount < 0) {
        return {
          isValid: false,
          error: 'Invalid payment amount',
          warnings
        };
      }
      
      // 检查金额是否过大
      if (paymentRequest.amount > 1000000000) { // 10 BTC
        warnings.push('Payment amount is unusually large');
      }
      
      return {
        isValid: true,
        warnings
      };
      
    } catch (error) {
      return {
        isValid: false,
        error: error.message,
        warnings
      };
    }
  }
}

// ==================== React Native 深度链接集成 ====================

import { Linking, Platform, Alert } from 'react-native';

/**
 * React Native 深度链接处理器
 */
export class DeepLinkHandler {
  
  /**
   * 初始化深度链接监听
   */
  static async initialize(): Promise<void> {
    try {
      // 获取初始 URL
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        await this.handleDeepLink(initialUrl);
      }
      
      // 监听深度链接
      Linking.addEventListener('url', async (event) => {
        await this.handleDeepLink(event.url);
      });
      
    } catch (error) {
      console.error('Failed to initialize deep linking:', error);
    }
  }

  /**
   * 处理深度链接
   * @param url 深度链接 URL
   */
  static async handleDeepLink(url: string): Promise<void> {
    try {
      console.log('Handling deep link:', url);
      
      // 解析支付请求
      const paymentRequest = PaymentRequestHandler.parsePaymentRequest(url);
      
      // 验证支付请求
      const validation = PaymentRequestHandler.validatePaymentRequest(paymentRequest);
      
      if (!validation.isValid) {
        throw new Error(`Invalid payment request: ${validation.error}`);
      }
      
      // 显示警告（如果有）
      if (validation.warnings.length > 0) {
        console.warn('Payment request warnings:', validation.warnings);
      }
      
      // 处理支付请求
      await this.processPaymentRequest(paymentRequest);
      
    } catch (error) {
      console.error('Failed to handle deep link:', error);
      this.showErrorAlert('Invalid Payment Link', error.message);
    }
  }

  /**
   * 处理支付请求
   * @param paymentRequest 支付请求
   */
  private static async processPaymentRequest(paymentRequest: PaymentRequest): Promise<void> {
    // 这里应该集成到你的支付流程中
    // 例如：导航到支付确认页面
    
    console.log('Processing payment request:', paymentRequest);
    
    // 显示确认对话框
    Alert.alert(
      'Payment Request',
      this.formatPaymentRequestMessage(paymentRequest),
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Pay', 
          onPress: () => this.executePayment(paymentRequest),
          style: 'default'
        }
      ]
    );
  }

  /**
   * 格式化支付请求消息
   */
  private static formatPaymentRequestMessage(paymentRequest: PaymentRequest): string {
    const amount = paymentRequest.amount;
    const currency = paymentRequest.currency;
    const description = paymentRequest.description || 'No description';
    const type = paymentRequest.type === 'bitcoin' ? 'Bitcoin' : 'Lightning';
    
    return `${type} Payment Request\n\n` +
           `Amount: ${amount} ${currency}\n` +
           `Description: ${description}\n\n` +
           `Do you want to proceed with this payment?`;
  }

  /**
   * 执行支付
   */
  private static async executePayment(paymentRequest: PaymentRequest): Promise<void> {
    try {
      // 这里应该调用你的支付 API
      console.log('Executing payment:', paymentRequest);
      
      // 模拟支付处理
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      Alert.alert('Success', 'Payment completed successfully!');
      
    } catch (error) {
      console.error('Payment failed:', error);
      this.showErrorAlert('Payment Failed', error.message);
    }
  }

  /**
   * 显示错误提示
   */
  private static showErrorAlert(title: string, message: string): void {
    Alert.alert(title, message, [{ text: 'OK' }]);
  }

  /**
   * 配置 iOS 的 URL 方案
   */
  static configureIOSURLSchemes(): void {
    if (Platform.OS === 'ios') {
      // 在 Info.plist 中添加以下配置：
      // <key>CFBundleURLTypes</key>
      // <array>
      //   <dict>
      //     <key>CFBundleURLSchemes</key>
      //     <array>
      //       <string>bitcoin</string>
      //       <string>lightning</string>
      //     </array>
      //   </dict>
      // </array>
    }
  }

  /**
   * 配置 Android 的 Intent 过滤器
   */
  static configureAndroidIntentFilters(): void {
    if (Platform.OS === 'android') {
      // 在 AndroidManifest.xml 中添加以下配置：
      // <intent-filter>
      //   <action android:name="android.intent.action.VIEW" />
      //   <category android:name="android.intent.category.DEFAULT" />
      //   <category android:name="android.intent.category.BROWSABLE" />
      //   <data android:scheme="bitcoin" />
      // </intent-filter>
      // <intent-filter>
      //   <action android:name="android.intent.action.VIEW" />
      //   <category android:name="android.intent.category.DEFAULT" />
      //   <category android:name="android.intent.category.BROWSABLE" />
      //   <data android:scheme="lightning" />
      // </intent-filter>
    }
  }
}

// ==================== 使用示例 ====================

/**
 * 使用示例
 */
export class BitcoinLinkExample {
  
  static async demonstrate(): Promise<void> {
    try {
      // 示例 1: 解析比特币 URI
      const bitcoinURI = 'bitcoin:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?amount=0.001&label=Donation&message=Thanks%20for%20your%20support';
      const parsedBitcoin = BitcoinURIParser.parse(bitcoinURI);
      console.log('Parsed Bitcoin URI:', parsedBitcoin);
      
      // 示例 2: 解析闪电网络发票
      const lightningInvoice = 'lightning:lnbc10u1p3unwvgpp5cfzwshq6t995k8m5cyqcq0q2wqkq5xr4e3s0e6q0v4q2r5q2gshq6t995k8m5cyqcq0q2wqkq5xr4e3s0e6q0v4q2r5q2gshq6t995k8m5cyqcq0q2wqkq5xr4e3s0e6q0v4q2r5q2gshq6t995k8m5cyqcq0q2wqkq5xr4e3s0e6q0v4q2r5q2g';
      const parsedLightning = LightningInvoiceParser.parse(lightningInvoice);
      console.log('Parsed Lightning Invoice:', parsedLightning);
      
      // 示例 3: 验证 URI
      const bitcoinValidation = BitcoinURIParser.validate(bitcoinURI);
      console.log('Bitcoin URI Validation:', bitcoinValidation);
      
      const lightningValidation = LightningInvoiceParser.validate(lightningInvoice);
      console.log('Lightning Invoice Validation:', lightningValidation);
      
      // 示例 4: 创建比特币 URI
      const createdURI = BitcoinURIParser.create('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', {
        amount: 0.005,
        label: 'Coffee',
        message: 'Thanks for the coffee!'
      });
      console.log('Created Bitcoin URI:', createdURI);
      
      // 示例 5: 处理支付请求
      const paymentRequest = PaymentRequestHandler.parsePaymentRequest(bitcoinURI);
      console.log('Payment Request:', paymentRequest);
      
      const paymentValidation = PaymentRequestHandler.validatePaymentRequest(paymentRequest);
      console.log('Payment Validation:', paymentValidation);
      
    } catch (error) {
      console.error('Example error:', error);
    }
  }
}

// ==================== 导出所有功能 ====================

export default {
  BitcoinURIParser,
  LightningInvoiceParser,
  PaymentRequestHandler,
  DeepLinkHandler,
  BitcoinLinkExample,
  BitcoinLinkError,
  LightningLinkError
};

// ==================== 测试用例 ====================

/**
 * 测试函数
 */
export async function testBitcoinLinkParser(): Promise<void> {
  console.log('=== Testing Bitcoin Link Parser ===');
  
  // 测试有效的比特币 URI
  const testCases = [
    // 比特币 URI 测试
    'bitcoin:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    'bitcoin:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?amount=0.001',
    'bitcoin:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?amount=0.001&label=Test',
    'bitcoin:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?amount=0.001&label=Test&message=Hello%20World',
    
    // 闪电网络测试
    'lightning:lnbc10u1p3unwvgpp5cfzwshq6t995k8m5cyqcq0q2wqkq5xr4e3s0e6q0v4q2r5q2g',
    
    // 混合支付测试
    'bitcoin:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?amount=0.001&lightning=lnbc10u1p3unwvgpp5cfzwshq6t995k8m5cyqcq0q2wqkq5xr4e3s0e6q0v4q2r5q2g'
  ];
  
  for (const testCase of testCases) {
    try {
      console.log(`\nTesting: ${testCase.substring(0, 50)}...`);
      const paymentRequest = PaymentRequestHandler.parsePaymentRequest(testCase);
      const validation = PaymentRequestHandler.validatePaymentRequest(paymentRequest);
      
      console.log('Type:', paymentRequest.type);
      console.log('Amount:', paymentRequest.amount, paymentRequest.currency);
      console.log('Valid:', validation.isValid);
      
      if (validation.warnings.length > 0) {
        console.log('Warnings:', validation.warnings);
      }
      
    } catch (error) {
      console.error('Test failed:', error.message);
    }
  }
  
  console.log('\n=== Testing Complete ===');
}

// 运行测试（在开发环境中）
if (process.env.NODE_ENV === 'development') {
  testBitcoinLinkParser().catch(console.error);
}