import 'dotenv/config'
import TelegramBot from 'node-telegram-bot-api'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const token = process.env.TOKEN
const channelId = process.env.CHANNEL_ID

if (!channelId) {
  console.error('Please provice channel id')
  process.exit(1)
}

if (!token) {
  console.error('Please provice bot token')
  process.exit(1)
}

const connectDatabase = async () => {
  try {
    await prisma.$connect()
    startBot()
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

const checkChat = async (chatId: number) => {
  try {
    const chat = await prisma.chat.findUnique({
      where: { telegramId: `${chatId}` },
    })

    if (!chat) {
      await prisma.chat.create({
        data: {
          telegramId: `${chatId}`,
        },
      })
    }
  } catch (err) {
    console.error('checking chat error', err)
  }
}

const startBot = () => {
  const bot = new TelegramBot(token, { polling: true })

  bot.onText(/\/start/, async (msg) => {
    await checkChat(msg.chat.id)
  })

  bot.on('message', async (msg) => {
    if (`${msg.chat.id}` !== channelId) {
      await checkChat(msg.chat.id)
      return
    }

    if (msg.photo || msg.text) {
      try {
        // get the image or text from the message
        const image = msg.photo ? msg.photo[msg.photo.length - 1].file_id : null
        const text = msg.text || ''

        const chats = await prisma.chat.findMany()

        // send the image or text to all groups
        for (const chat of chats) {
          try {
            if (image) {
              await bot.sendPhoto(chat.telegramId, image)
            } else {
              await bot.sendMessage(chat.telegramId, text)
            }
          } catch (err: any) {
            if (err.response?.body?.error_code === 403) {
              console.log('Skipped Chat:', chat.telegramId)
            }
          }
        }
      } catch (err) {
        console.error('Error while recieving a message', err)
      }
    }
  })
}

connectDatabase()
