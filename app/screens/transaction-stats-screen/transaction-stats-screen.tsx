import React, { useEffect, useState } from "react"
import { View, Text, ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, Alert, Platform } from "react-native"
import { gql, useLazyQuery } from "@apollo/client"
import { Screen } from "../../components/screen"
import { palette } from "../../theme/palette"
import { translate } from "../../i18n"
import useMainQuery from "@app/hooks/use-main-query"
import crashlytics from "@react-native-firebase/crashlytics"
import Share from "react-native-share"
import * as currency_fmt from "currency.js"
import { select } from "@storybook/addon-knobs"
import RNFS from "react-native-fs"

const GET_CSV_TRANSACTIONS = gql`
  query getWalletCSVTransactions($defaultWalletId: WalletId!) {
    me {
      id
      defaultAccount {
        id
        csvTransactions(walletIds: [$defaultWalletId])
      }
    }
  }
`

export const TransactionStatsScreen: React.FC = () => {
  const [stats, setStats] = useState<{
    totalReceiveFiat: number
    totalSendFiat: number
    totalReceiveBtc: number
    totalSendBtc: number
    transactionCount: number
  } | null>(null)

  const [selectedFilter, setSelectedFilter] = useState<'week' | 'month' | 'year' | 'all'>('all');

  const { btcWalletId } = useMainQuery()

  const [fetchCsvTransactions, { loading: loadingCsvTransactions, error: csvError, data: csvData }] = useLazyQuery(GET_CSV_TRANSACTIONS, {
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
    onError: (error) => {
      crashlytics().recordError(error)
    },
  })

  const handleExportCsv = async () => {
    if (!btcWalletId) return

    try {
      // Use the csvData state that was already fetched
      const csvTransactions = csvData?.me?.defaultAccount?.csvTransactions
      if (csvTransactions) {
        if (Platform.OS === 'android') {
          // For Android, write base64 CSV to file first, then share the file
          const tempPath = `${RNFS.CachesDirectoryPath}/bj-transactions.csv`
          
          await RNFS.writeFile(tempPath, csvTransactions, 'base64')
          
          await Share.open({
            title: "bj-transactions.csv",
            message: "bj-transactions.csv",
            url: `file://${tempPath}`,
            type: "text/csv",
            filename: "bj-transactions.csv",
            failOnCancel: false,
            saveToFiles: true,
          })
          
          // Clean up temp file after a delay
          setTimeout(() => {
            RNFS.unlink(tempPath).catch(console.warn)
          }, 5000)
        } else {
          // iOS can handle data URLs directly
          await Share.open({
            title: "bj-transactions.csv",
            message: "bj-transactions.csv",
            url: `data:text/csv;base64,${csvTransactions}`,
            type: "text/csv",
            filename: "bj-transactions.csv",
            failOnCancel: false,
            saveToFiles: true,
          })
        }
      } else {
        throw new Error("CSV data not available")
      }
    } catch (err) {
      console.error(err)
      Alert.alert(
        translate("common.error"),
        translate("SettingsScreen.csvTransactionsError"),
        [{ text: translate("common.ok") }]
      )
    }
  }

  const handleFilterChange = (filter: 'week' | 'month' | 'year' | 'all') => {
    setSelectedFilter(filter);
    // Implement logic to filter transactions based on the selected filter
    // For example, you can fetch data again based on the new filter value
  };

  useEffect(() => {
    if (btcWalletId) {
      fetchCsvTransactions({ variables: { defaultWalletId: btcWalletId } })
    }
  }, [btcWalletId, fetchCsvTransactions])

  useEffect(() => {
    if (csvData?.me?.defaultAccount?.csvTransactions) {
      const csvString = atob(csvData.me.defaultAccount.csvTransactions)
      const parsedStats = parseTransactions(csvString)
      setStats(parsedStats)
    }
  }, [csvData, selectedFilter])

  const parseTransactions = (csvData: string) => {
    const rows = csvData.split('\n')
    let totalReceiveFiat = 0
    let totalSendFiat = 0
    let totalReceiveBtc = 0
    let totalSendBtc = 0
    let transactionCount = 0

    const headers = rows[0].split(',')
    const headerIndexMap = {}
    headers.forEach((header, index) => {
      headerIndexMap[header.trim()] = index
    })

    const currentTime = new Date().getTime();

    for (let i = 1; i < rows.length; i++) {
      if (!rows[i].trim()) continue
      const columns = rows[i].split(',')
      
      const sats = Number(columns[headerIndexMap['sats']] || '0')
      const usd = Number(columns[headerIndexMap['usd']] || '0')
      const debit = columns[headerIndexMap['debit']] || '0'
      const credit = columns[headerIndexMap['credit']] || '0'
      const unixTimestamp = Number(columns[headerIndexMap['unix']] || '0') * 1000

      if(selectedFilter === 'week' && currentTime - unixTimestamp > 7 * 24 * 60 * 60 * 1000) {
        continue
      }

      if(selectedFilter === 'month' && currentTime - unixTimestamp > 30 * 24 * 60 * 60 * 1000) {
        continue
      }

      if(selectedFilter === 'year' && currentTime - unixTimestamp > 365 * 24 * 60 * 60 * 1000) {
        continue
      }

      let btcAmount = sats / 100000000

      if (debit !== '0') {
        totalSendFiat += usd
        totalSendBtc += btcAmount
      } else if (credit !== '0') {
        totalReceiveFiat += usd
        totalReceiveBtc += btcAmount
      }

      transactionCount++
    }

    return {
      totalReceiveFiat,
      totalSendFiat,
      totalReceiveBtc,
      totalSendBtc,
      transactionCount,
    }
  }

  if (loadingCsvTransactions) {
    return (
      <Screen preset="scroll">
        <ActivityIndicator size="large" color={palette.lightBlue} />
      </Screen>
    )
  }

  if (csvError) {
    return (
      <Screen preset="scroll">
        <Text style={styles.errorText}>{translate("common.error")}</Text>
      </Screen>
    )
  }

  return (
    <Screen preset="scroll">
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{translate("TransactionStatsScreen.title")}</Text>
        <View style={styles.filterButtons}>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'week' && styles.selectedFilter]}
            onPress={() => handleFilterChange('week')}
          >
            <Text style={selectedFilter === 'week' ? styles.selectedFilterButtonText : styles.filterButtonText}>Week</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'month' && styles.selectedFilter]}
            onPress={() => handleFilterChange('month')}
          >
            <Text style={selectedFilter === 'month' ? styles.selectedFilterButtonText : styles.filterButtonText}>Month</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'year' && styles.selectedFilter]}
            onPress={() => handleFilterChange('year')}
          >
            <Text style={selectedFilter === 'year' ? styles.selectedFilterButtonText : styles.filterButtonText}>Year</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'all' && styles.selectedFilter]}
            onPress={() => handleFilterChange('all')}
          >
            <Text style={selectedFilter === 'all' ? styles.selectedFilterButtonText : styles.filterButtonText}>All</Text>
          </TouchableOpacity>
        </View>
        {stats && (
          <>
            <StatItem 
              label={translate("TransactionStatsScreen.totalReceiveFiat")} 
              value={
                currency_fmt
                .default(stats.totalReceiveFiat, { precision: 2, symbol: "₡", separator: ".", decimal: "," })
                .format()
              }
            />
            <StatItem 
              label={translate("TransactionStatsScreen.totalSendFiat")} 
              value={
                currency_fmt
                .default(stats.totalSendFiat, { precision: 2, symbol: "₡", separator: ".", decimal: "," })
                .format()
              }
            />
            <StatItem 
              label={translate("TransactionStatsScreen.totalReceiveBtc")} 
              value={
                currency_fmt
                .default(stats.totalReceiveBtc, { precision: 8, symbol: "", separator: ".", decimal: "," })
                .format()
              }
            />
            <StatItem 
              label={translate("TransactionStatsScreen.totalSendBtc")} 
              value={
                currency_fmt
                .default(stats.totalSendBtc, { precision: 8, symbol: "", separator: ".", decimal: "," })
                .format()
              }
            />
            <StatItem 
              label={translate("TransactionStatsScreen.transactionCount")} 
              value={
                currency_fmt
                .default(stats.transactionCount, { precision: 0, symbol: "", separator: ".", decimal: "," })
                .format()
              }
            />
          </>
        )}
        <TouchableOpacity style={styles.exportButton} onPress={handleExportCsv} disabled={loadingCsvTransactions}>
          <Text style={styles.exportButtonText}>
            {loadingCsvTransactions
              ? translate("common.loading")
              : translate("common.csvExport")}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  )
}

const StatItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.statItem}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
)

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: palette.darkGrey,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 16,
    color: palette.darkGrey,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: palette.darkGrey,
  },
  errorText: {
    color: palette.red,
    fontSize: 16,
    textAlign: 'center',
  },
  exportButton: {
    backgroundColor: palette.lightBlue,
    padding: 10,
    borderRadius: 5,
    marginTop: 20,
    alignItems: 'center',
  },
  exportButtonText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  filterButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    marginBottom: 10,
  },
  filterButton: {
    padding: 10,
    borderRadius: 5,
  },
  selectedFilter: {
    backgroundColor: palette.lightBlue,
  },
  filterButtonText: {
    color: palette.darkGrey,
  },
  selectedFilterButtonText: {
    color: palette.white,
  }
})