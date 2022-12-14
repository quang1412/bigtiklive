import React, { useEffect, useState } from "react"
import style from "./style.module.css"
import { Bar } from "react-chartjs-2"
import ChartDataLabels from "chartjs-plugin-datalabels"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js"
import DemoData from "./demoData"
import BigtikProRequired from "../../components/bigtikProRequired"

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const LastEvents = (props) => {
  return (
    <div className={style.recentEvent}>
      {props.events.map(({ nickname, uniqueId, likeCount }, index) => (
        <p
          key={index}
          className="mb-0 text-nowrap"
          style={{ color: props.color }}
        >
          {`${nickname || uniqueId} ♥︎ x ${likeCount}`}
        </p>
      ))}
    </div>
  )
}

const BarChart = (props) => {
  const { getValue, topRanking, viewerData, viewerPoint } = props
  return (
    <Bar
      plugins={[ChartDataLabels]}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        layout: {
          padding: {
            top: 15,
            right: 15,
            bottom: 15,
            left: 145,
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          datalabels: {
            display: true,
            font: {
              size: 14,
              weight: 500,
            },
            padding: {
              left: 10,
              right: 10,
            },
            color: getValue("barColor") || "#3d3d3d",
            align: "right",
            anchor: "start",
          },
          tooltip: {
            displayColors: false,
          },
        },
        title: {
          display: false,
          text: "",
        },
        scales: {
          x: {
            display: false,
          },
          y: {
            grid: {
              display: false,
            },
            ticks: {
              display: false,
              font: {
                size: 14,
                weight: 500,
              },
              color: "#fff",
            },
          },
        },
      }}
      data={{
        labels: topRanking[0]
          ? topRanking.map((uniqueId) => {
              return (viewerData[uniqueId].nickname || uniqueId).substring(
                0,
                15
              )
            })
          : ["top 1", "top 2", "top 3", "top 4", "top 5"],
        datasets: [
          {
            label: "Lượt like",
            backgroundColor: getValue("barBgColor") || "#e7a6e2",
            borderRadius: 5,
            borderSkipped: false,
            data: topRanking[0]
              ? topRanking.map((uniqueId) => {
                  return viewerPoint[uniqueId]
                })
              : [0, 0, 0, 0, 0],
          },
        ],
      }}
    />
  )
}

const TopperNameImage = (props) => {
  const { topRanking, getValue, viewerData } = props
  return topRanking.map((uniqueId) => (
    <div key={uniqueId} className={style.topUser}>
      <span className={style.name} style={{ color: getValue("textColor") }}>
        {(viewerData[uniqueId].nickname || uniqueId).substring(0, 15)}
      </span>
      <img
        className={style.avatar}
        src="/assets/images/default-avatar.webp"
        data-url={viewerData[uniqueId].profilePictureUrl}
        onLoad={window.imageOnLoad}
        // src={window.imageUrlFixing(viewerData[uniqueId].profilePictureUrl)}
        // onError={window.imageOnError}
        alt="avatar"
      />
    </div>
  ))
}

const TopLike = (props) => {
  const { settings, event, isDemo, isProChannel } = props
  const [viewerData, setViewerData] = useState({})
  const [viewerPoint, setViewerPoint] = useState({})
  const [lastEvents, setLastEvents] = useState([])
  const [topRanking, setTopRanking] = useState([])
  const [resetCountDown, updateResetCountDown] = useState(0)

  const sValue = (shortName) => settings[`widget_likeranking_${shortName}`]

  useEffect(() => {
    updateResetCountDown(sValue("resetAfterMinute") * 60)

    if (!sValue("autoResetEnabled")) {
      return
    }

    const countDownTimmer = setInterval(() => {
      updateResetCountDown((current) => current - 1)
    }, 1000)

    return () => {
      clearInterval(countDownTimmer)
    }
  }, [settings])

  useEffect(() => {
    const time = sValue("resetAfterMinute")

    if (resetCountDown < 0) {
      console.log("reset like rank")
      setViewerPoint({})
      setLastEvents([])
      updateResetCountDown(time * 60)
    }
  }, [resetCountDown])

  useEffect(() => {
    if (!isDemo && !isProChannel) return

    if (event.name === "reset-likerank") {
      setViewerPoint({})
      setLastEvents([])
    } else if (event.name === "like" && event.id) {
      const {
        userId,
        uniqueId,
        nickname,
        likeCount,
        profilePictureUrl,
        followRole,
      } = event
      !viewerData[uniqueId] &&
        setViewerData((current) => ({
          ...current,
          [uniqueId]: {
            nickname,
            profilePictureUrl,
            uniqueId,
            userId,
            followRole,
          },
        }))
      setViewerPoint((current) => ({
        ...current,
        [uniqueId]: (current[uniqueId] || 0) + likeCount,
      }))
      setLastEvents((current) => [event, ...current.slice(0, 13)])
    }
  }, [event])

  useEffect(() => {
    let top = Object.keys(viewerPoint).sort(function (a, b) {
      return viewerPoint[b] - viewerPoint[a]
    })
    setTopRanking(top.slice(0, 10))
  }, [viewerPoint])

  useEffect(() => {
    return () => {
      updateResetCountDown(sValue("resetAfterMinute") * 60)
      if (!window.cid) {
        setViewerData(DemoData.viewerData)
        setViewerPoint(DemoData.viewerPoint)
        setLastEvents(DemoData.lastEvents)
        setTopRanking(DemoData.topRanking)
      }
    }
  }, [])

  return (
    <div className={style.App}>
      <div className={style.main}>
        <div
          className="d-flex align-items-baseline"
          style={{ color: sValue("titleColor") }}
        >
          {sValue("title") && (
            <h4 className={style.title}>{sValue("title")}</h4>
          )}
          {sValue("autoResetEnabled") && (
            <strong
              className={
                "ms-4 " +
                (resetCountDown < 11
                  ? "animate__animated animate__pulse animate__faster animate__infinite"
                  : "")
              }
            >
              <i className="far fa-clock"></i> {resetCountDown}s
            </strong>
          )}
        </div>
        <div
          className={style.chartContainer}
          style={{
            backgroundImage: sValue("bgImageEnabled")
              ? `url(${
                  sValue("bgImageUrl") ||
                  "/assets/images/default-like-rank-bg-jpg"
                })`
              : "unset",
          }}
        >
          <div className={style.topRankBar}>
            <TopperNameImage
              topRanking={topRanking}
              getValue={sValue}
              viewerData={viewerData}
            />
          </div>
          <div
            className={style.chart}
            style={{
              backgroundColor: `rgb(0, 0, 0, ${sValue("bgOpacity") / 100})`,
            }}
          >
            <BarChart
              getValue={sValue}
              topRanking={topRanking}
              viewerData={viewerData}
              viewerPoint={viewerPoint}
            />
          </div>
          <LastEvents events={lastEvents} color={sValue("textColor")} />
        </div>
      </div>
    </div>
  )
}

export default TopLike
