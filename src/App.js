import React, { useState, useEffect, useRef, memo, lazy, Suspense } from "react"
import "react-toastify/dist/ReactToastify.css"
import "./App.css"
import io from "socket.io-client"
import { getAuth } from "firebase/auth"
import { MDBContainer } from "mdb-react-ui-kit"
import { ToastContainer, toast } from "react-toastify"
import { getChannelSettings, saveChannelSetting } from "./modules/fireBase.js"
import { defaultSettings } from "./modules/fakeData"
import StartScreen from "./components/loadingScreen"
import Navbar from "./components/navBar"
// import EventLog from "./components/eventLog"

const GetStarted = lazy(() => import("./pages/getStarted"))
const BasicSetting = lazy(() => import("./pages/basicSetting"))
const UserAndPoint = lazy(() => import("./pages/userAndPoint"))
const Widgets = lazy(() => import("./pages/widgets"))
const TextToSpeech = lazy(() => import("./pages/textToSpeech"))

const auth = getAuth()
window.toast = toast
window.idEditDelay = 3600 //seconds 3600 = 1 hour
window.limitTotalUser = 5000
window.createFakeEvent = (name = null) => {
  try {
    name
      ? window.socketio.emit("fakeEvent", name)
      : window.socketio.emit("fakeEvent")
    window.toast.success("đã gửi sự kiện thử nghiệm")
  } catch (e) {}
}
window.handleCopy = (e) => {
  const target = e.target
  const id = target.getAttribute("data-copy-target")
  const input = document.getElementById(id)
  const value = input.value

  navigator.clipboard
    .writeText(value)
    .then(function () {
      input.select()
      window.toast.success("Đã copy vào bộ nhớ đệm")
    })
    .catch(function (err) {
      window.toast.error("Đã xảy ra lỗi")
    })
}
window.getUserLevel = (point, levelPoint, levelMultiplier) => {
  // const level = point / (levelPoint * levelMultiplier)
}

function onAuthStateChanged() {
  return new Promise((resolve) => {
    auth.onAuthStateChanged(resolve)
  })
}

function channelDuplicateCheck(cid) {
  return new Promise((resolve, reject) => {
    fetch(`/api/channel-approve?cid=${cid}`)
      .then((r) => r.json())
      .then((result) => {
        if (result.error) return reject(result.error_msg)
        else return resolve(true)
      })
      .catch((err) => {
        return reject(`${err}`)
      })
  })
}

function App() {
  const isProChannel = useRef(false)
  const authDataRef = useRef(null)
  const [_loadingTitle, setLoadingTitle] = useState("Đang chuẩn bị")
  const [_loadingText, setLoadingText] = useState("...")
  const [_urlHash, setPageName] = useState(
    window.location.hash.replace("#", "") || "home"
  )
  const [_settings, updateSettings] = useState(defaultSettings())
  const [_ttRoomInfo, setTtRoomInfo] = useState({})
  const [_lastEvent, setLastEvent] = useState({})
  const [userData, setUserData] = useState(() => {
    var data = {}
    try {
      data = JSON.parse(window.localStorage.userData)
    } finally {
      return data
    }
  })
  const [roomList, setRoomList] = useState([])
  const popupWindows = useRef([])

  const likeStorage = useRef({})
  const likeDelay = (event) => {
    const { uniqueId, likeCount } = event
    clearTimeout(likeStorage.current[uniqueId]?.timeOut)
    const totalLike =
      (likeStorage.current[uniqueId]?.likeCount || 0) + likeCount
    likeStorage.current[uniqueId] = {
      likeCount: totalLike,
      timeOut: setTimeout(() => {
        setLastEvent({ ...event, likeCount: totalLike })
        console.log(`👍👍 ${uniqueId} send total ${totalLike} like`)
        delete likeStorage.current[uniqueId]
      }, 5000),
    }
  }

  window.widgetControl = (action) => {
    try {
      window.socketio.emit("widget-control", action)
      setLastEvent({ name: action })
    } catch (e) {}
  }

  function createSocketConnect(cid) {
    return new Promise((resolve, reject) => {
      window.socketio && window.socketio.disconnect()

      const socket = io(`/?cid=${cid}`, {
        transports: ["websocket"],
        path: "/socket",
      })

      var connectTimeout = setTimeout(() => {
        socket.disconnect()
        return reject("Kết nối websocket thất bại, vui lòng thử lại sau")
      }, 30000)

      const onConnected = () => {
        socket.off("connect", onConnected)
        clearTimeout(connectTimeout)
        return resolve(socket)
      }

      socket.on("connect", onConnected)

      socket.on("tiktok-connectFailed", (error) => {
        console.log(error)
        window.toast.error(`${error}`)
      })

      socket.on("tiktok-disconnected", () => {
        setTtRoomInfo((current) => ({ ...current, isConnected: false }))
        console.log("❌ disconnect")
      })

      socket.on("tiktok-roomInfo", (roomInfo) => {
        setTtRoomInfo(roomInfo)
        console.log("Room Info:", roomInfo)
        roomInfo.isConnected && window.toast.success(`Đã kết nối livestream`)
      })

      socket.on("tiktok-like", (event) => {
        likeDelay(event)
        console.log(`👍 ${event.uniqueId} send ${event.likeCount} like`)
      })

      socket.on("tiktok-gift", (event) => {
        setLastEvent(event)
        if (event.giftType === 1 && !event.repeatEnd) {
          // console.log(`${event.uniqueId} is sending gift ${event.giftName} x${event.repeatCount}`);
        } else {
          console.log(
            `🎁 ${event.uniqueId} has sent gift ${event.giftName} x${event.repeatCount}`
          )
        }
      })

      socket.on("tiktok-chat", (event) => {
        console.log(`💬 ${event.uniqueId} say: ${event.comment}`)
        setLastEvent(event)
      })

      socket.on("tiktok-share", (event) => {
        console.log(`🚀 ${event.uniqueId} shared`)
        setLastEvent(event)
      })

      socket.on("tiktok-follow", (event) => {
        console.log(`📌 ${event.uniqueId} followed`)
        setLastEvent(event)
      })

      socket.on("tiktok-roomUser", (event) => {
        setTtRoomInfo((current) => ({
          ...current,
          viewerCount: event.viewerCount,
        }))
      })

      socket.on("broadcast-roomList", (roomList) => {
        setRoomList(roomList)
        console.log(roomList)
      })
    })
  }

  function onSettingChange(e) {
    if (!authDataRef.current)
      return window.toast.info("vui lòng đăng nhập / đăng ký")

    const target = e.target
    const type = target.type
    const name = target.name
    var value = target.value

    if (name === "basic_updateidat" || name === "basic_tiktokid") return

    console.log(name, value)

    switch (type) {
      case "radio":
        if ("true false".includes(value)) {
          value = value === "true"
        }
        break
      case "checkbox":
        value = target.checked
        break
      case "number":
      case "range":
        const min = parseInt(target.min)
        const int = parseInt(value || min)
        const float = parseFloat(value || min)
        value = Math.max(min, int, float)
        target.value = value
        break
      case "text":
        break
      default:
    }
    return updateSettings((current) => ({ ...current, [name]: value }))
  }

  useEffect(() => {
    localStorage.setItem("userData", JSON.stringify(userData))
  }, [userData]) // Lưu userData vào localStorage

  useEffect(() => {
    // window.popups.map((popup) =>
    //   popup.postMessage(_lastEvent, "https://bigtik-shotting-game.glitch.me/")
    // )
    const cid = window.cid
    if (!cid) return

    const { name, userId, uniqueId, userDetails, followRole } = _lastEvent
    const isFollower = followRole > 0
    const now = new Date().getTime()

    function handleReward(amount) {
      setUserData((current) => {
        if (current[userId]) {
          const user = current[userId]
          const totalAmount = user.totalAmount + amount
          const totalRewardAmount = user.totalRewardAmount + amount
          return {
            ...current,
            [userId]: {
              ...user,
              totalAmount: totalAmount,
              totalRewardAmount: totalRewardAmount,
              thumbnailUrl: userDetails.profilePictureUrls[0],
              updateAt: now,
            },
          }
        } else if (Object.keys(current).length >= window.limitTotalUser) {
          return current
        } else {
          return {
            ...current,
            [userId]: {
              id: userId,
              username: uniqueId,
              userId: userId.toString(),
              channelId: cid.toString(),
              createAt: now,
              updateAt: now,
              thumbnailUrl: userDetails.profilePictureUrls[0],
              totalAmount: amount,
              totalRewardAmount: amount,
            },
          }
        }
      })
    }

    async function handleEvent() {
      if (_lastEvent.test) return
      switch (name) {
        case "gift":
          const { giftType, repeatEnd, diamondCount, repeatCount } = _lastEvent
          if (giftType === 1 && !repeatEnd) break

          if (_settings.basic_coinperdiamondenabled) {
            const amount =
              diamondCount * repeatCount * _settings.basic_coinperdiamond
            const bonus = !isFollower
              ? 0
              : parseFloat(
                  ((_settings.basic_followerbonus / 100) * amount).toFixed(1)
                )
            handleReward(amount + bonus)
          }
          break
        case "share":
          if (_settings.basic_coinpershareenabled) {
            const amount = _settings.basic_coinpershare
            const bonus = !isFollower
              ? 0
              : parseFloat(
                  ((_settings.basic_followerbonus / 100) * amount).toFixed(1)
                )
            handleReward(amount + bonus)
          }
          break
        default:
          break
      }
    }
    handleEvent()
  }, [_lastEvent, _settings]) // Tính điểm thành viên;

  useEffect(() => {
    // if (_loadingText || _settings === {}) return;
    if (!window.socketio || !authDataRef.current) return
    clearTimeout(window.settingSaveDelay)
    window.settingSaveDelay = setTimeout(() => {
      saveChannelSetting(window.cid, _settings)
        .then(() => {
          try {
            window.socketio.emit("updateSetting", _settings)
          } catch (e) {
            throw new Error(e)
          }
        })
        .catch(async (error) => {
          toast.error("Xảy ra lỗi vui lòng thử lại sau")
          console.error(error)
        })
    }, 1500)
  }, [_settings]) // Lưu cài đặt

  useEffect(() => {
    document.title = `Bigtik ${
      _ttRoomInfo.isConnected
        ? `[LIVE] ${_ttRoomInfo.viewerCount || 0} viewer`
        : ""
    }`
  }, [_ttRoomInfo]) // Update page title

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace("#", "")
      setPageName(hash)
      window.scrollTo(0, 0)
    }
    window.addEventListener("hashchange", onHashChange, false)
    return () => {
      window.removeEventListener("hashchange", onHashChange, false)
    }
  }, []) // On url hash change

  useEffect(() => {
    const getStart = () => {
      setLoadingTitle("Đang chuẩn bị")
      setLoadingText("Xác thực tài khoản")

      onAuthStateChanged()
        .then(async (authData) => {
          // Đã login
          if (authData) {
            authDataRef.current = authData
            const cid = authData.uid
            window.cid = cid

            await channelDuplicateCheck(cid)

            await window.wait(1.5)
            setLoadingText("Kết nối websocket")
            window.socketio = await createSocketConnect(cid)

            await window.wait(1.5)
            setLoadingText("Tải thông tin tài khoản")
            const settings = await getChannelSettings(cid)
            updateSettings(settings)
            // console.log("Channel Settings:", settings)
            isProChannel.current =
              settings.basic_proexpirationdate > new Date().getTime()
            setTtRoomInfo({
              roomInfo: {
                owner: {
                  display_id: settings.basic_tiktokid,
                },
              },
            })

            await window.wait(1.5)
            setLoadingText(null)
          }
          // chưa login
          else {
            await window.wait(1.5)
            setLoadingText(null)
          }
        })
        .catch(async (err) => {
          await window.wait(1.5)
          setLoadingTitle("Xảy ra lỗi")
          setLoadingText(`${err}`)
          window.socketio && window.socketio.disconnect()
        })
    }

    window.start = setTimeout(getStart, 200)
    return () => window.clearTimeout(window.start)
  }, []) // Khởi động

  return _loadingText ? (
    <StartScreen title={_loadingTitle} text={_loadingText} />
  ) : (
    <div className="App">
      <Navbar
        roomInfo={_ttRoomInfo}
        pageName={_urlHash}
        isProChannel={isProChannel.current}
      />
      <MDBContainer className="p-3 text-start" style={{ marginTop: "70px" }}>
        {_urlHash === "setup" ? (
          <Suspense fallback={<div>Loading</div>}>
            <BasicSetting
              settings={_settings}
              handleSettingChange={onSettingChange}
              updateSettings={updateSettings}
              setUserData={setUserData}
            />
          </Suspense>
        ) : _urlHash === "widgets" ? (
          <Suspense fallback={<div>Loading</div>}>
            <Widgets
              authData={authDataRef.current}
              settings={_settings}
              handleSettingChange={onSettingChange}
              event={_lastEvent}
              setEvent={setLastEvent}
            />
          </Suspense>
        ) : _urlHash === "user-point" ? (
          <Suspense fallback={<div>Loading</div>}>
            <UserAndPoint
              authData={authDataRef.current}
              settings={_settings}
              users={userData}
            />
          </Suspense>
        ) : _urlHash === "text-to-speech" ? (
          <Suspense fallback={<div>Loading</div>}>
            <TextToSpeech settings={_settings} />
          </Suspense>
        ) : (
          <Suspense fallback={<div>Loading</div>}>
            <GetStarted roomList={roomList} />
          </Suspense>
        )}
        {/* <EventLog event={_lastEvent} /> */}
        <ToastContainer
          theme="light"
          position="bottom-right"
          toastStyle={{
            fontSize: "14px",
            textAlign: "left",
          }}
          hideProgressBar={false}
        />
      </MDBContainer>
    </div>
  )
}

export default memo(App)

// git push command
// git init
// git commit -m 'Init'
// git remote add origin https://github.com/quang1412/bigtiklive.git
// git branch -M main
// git commit -a -m "make it better"
// git push -u origin main

// https://github.com/quang1412/bigtiklive.git
