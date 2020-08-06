import React, { useState, useEffect } from "react";
import { useHistory, useParams } from "react-router-dom";
import openSocket from "socket.io-client";
import { format } from "date-fns";
import { toast } from "react-toastify";
import InfiniteScroll from "react-infinite-scroller";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import List from "@material-ui/core/List";
import SearchIcon from "@material-ui/icons/Search";
import InputBase from "@material-ui/core/InputBase";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import MoveToInboxIcon from "@material-ui/icons/MoveToInbox";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import IconButton from "@material-ui/core/IconButton";
import AddIcon from "@material-ui/icons/Add";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";

import TicketsSkeleton from "../TicketsSkeleton";
import NewTicketModal from "../NewTicketModal";
import TicketsList from "../TicketsList";
import TabPanel from "../TabPanel";

import api from "../../services/api";

const useStyles = makeStyles(theme => ({
	contactsWrapper: {
		position: "relative",
		display: "flex",
		height: "100%",
		flexDirection: "column",
		overflow: "hidden",
		borderTopRightRadius: 0,
		borderBottomRightRadius: 0,
	},

	tabsHeader: {
		// display: "flex",
		flex: "none",
		backgroundColor: "#eee",
	},

	settingsIcon: {
		alignSelf: "center",
		marginLeft: "auto",
		padding: 8,
	},

	tab: {
		minWidth: 120, // a number of your choice
		width: 120, // a number of your choice
	},

	halfTicketsList: {
		height: "50%",
		overflowY: "scroll",
		"&::-webkit-scrollbar": {
			width: "8px",
			height: "8px",
		},
		"&::-webkit-scrollbar-thumb": {
			boxShadow: "inset 0 0 6px rgba(0, 0, 0, 0.3)",
			backgroundColor: "#e8e8e8",
		},
		borderTop: "1px solid rgba(0, 0, 0, 0.12)",
	},

	fullHeightTicketsList: {
		flex: 1,
		overflowY: "scroll",
		"&::-webkit-scrollbar": {
			width: "8px",
			height: "8px",
		},
		"&::-webkit-scrollbar-thumb": {
			boxShadow: "inset 0 0 6px rgba(0, 0, 0, 0.3)",
			backgroundColor: "#e8e8e8",
		},
		borderTop: "2px solid rgba(0, 0, 0, 0.12)",
	},

	ticketsListHeader: {
		display: "flex",
		// flexShrink: 0,
		// -webkitBoxAlign: "center",
		alignItems: "center",
		fontWeight: 500,
		fontSize: "16px",
		height: "56px",
		// backgroundColor: "#eee",
		color: "rgb(67, 83, 105)",
		padding: "0px 12px",
		borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
	},

	ticketsCount: {
		fontWeight: "normal",
		color: "rgb(104, 121, 146)",
		marginLeft: "8px",
		fontSize: "14px",
	},

	ticketsListActions: {
		flex: "none",
		marginLeft: "auto",
	},

	noTicketsDiv: {
		display: "flex",
		height: "100px",
		margin: 40,
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
	},

	noTicketsText: {
		textAlign: "center",
		color: "rgb(104, 121, 146)",
		fontSize: "14px",
		lineHeight: "1.4",
	},

	noTicketsTitle: {
		textAlign: "center",
		fontSize: "16px",
		fontWeight: "600",
		margin: "0px",
	},

	contactsSearchBox: {
		position: "relative",
		background: "#fafafa",
		padding: "10px 13px",
	},

	serachInputWrapper: {
		background: "#fff",
		display: "flex",
		borderRadius: 40,
		padding: 4,
	},

	searchIcon: {
		color: "grey",
		marginLeft: 6,
		marginRight: 6,
		alignSelf: "center",
	},

	contactsSearchInput: {
		flex: 1,
		border: "none",
		borderRadius: 30,
	},
}));

const Tickets = () => {
	const classes = useStyles();
	const history = useHistory();

	const token = localStorage.getItem("token");
	const userId = +localStorage.getItem("userId");
	const { ticketId } = useParams();
	const [tickets, setTickets] = useState([]);
	const [loading, setLoading] = useState();
	const [searchParam, setSearchParam] = useState("");
	const [tab, setTab] = useState("open");
	const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
	const [showAllTickets, setShowAllTickets] = useState(false);

	const [pageNumber, setPageNumber] = useState(1);
	const [count, setCount] = useState(0);

	useEffect(() => {
		if (!("Notification" in window)) {
			console.log("This browser doesn't support notifications");
		} else {
			Notification.requestPermission();
		}
	}, []);

	useEffect(() => {
		setTickets([]);
		setPageNumber(1);
	}, [searchParam, tab]);

	useEffect(() => {
		setLoading(true);
		const delayDebounceFn = setTimeout(() => {
			const fetchContacts = async () => {
				try {
					const { data } = await api.get("/tickets", {
						params: { searchParam, pageNumber, status: tab },
					});
					setTickets(prevState => {
						return [...prevState, ...data.tickets];
					});
					setCount(data.count);
					setLoading(false);
				} catch (err) {
					console.log(err);
				}
			};
			fetchContacts();
		}, 1000);
		return () => clearTimeout(delayDebounceFn);
	}, [searchParam, pageNumber, token, tab]);

	useEffect(() => {
		const socket = openSocket(process.env.REACT_APP_BACKEND_URL);

		socket.emit("joinNotification");

		socket.on("ticket", data => {
			if (data.action === "updateUnread") {
				resetUnreadMessages(data);
			}
			if (data.action === "updateStatus" || data.action === "create") {
				updateTickets(data);
			}
			if (data.action === "delete") {
				deleteTicket(data);
				if (ticketId && data.ticketId === +ticketId) {
					toast.warn("O ticket que você estava foi deletado.");
					history.push("/chat");
				}
			}
		});

		socket.on("appMessage", data => {
			if (data.action === "create") {
				updateTickets(data);
				if (
					(ticketId &&
						data.message.ticketId === +ticketId &&
						document.visibilityState === "visible") ||
					(data.ticket.userId !== userId && data.ticket.userId)
				)
					return;
				showDesktopNotification(data);
			}
		});

		return () => {
			socket.disconnect();
		};
	}, [ticketId, userId, history]);

	const loadMore = () => {
		if (loading) return;
		setPageNumber(prevPageNumber => prevPageNumber + 1);
	};

	const updateTickets = ({ ticket }) => {
		setTickets(prevState => {
			const ticketIndex = prevState.findIndex(t => t.id === ticket.id);

			if (ticketIndex === -1) {
				return [ticket, ...prevState];
			} else {
				let aux = [...prevState];
				aux[ticketIndex] = ticket;
				aux.unshift(aux.splice(ticketIndex, 1)[0]);
				return aux;
			}
		});
	};

	const deleteTicket = ({ ticketId }) => {
		setTickets(prevState => {
			const ticketIndex = prevState.findIndex(ticket => ticket.id === ticketId);

			if (ticketIndex === -1) {
				return prevState;
			} else {
				let aux = [...prevState];
				aux.splice(ticketIndex, 1);
				return aux;
			}
		});
	};

	const showDesktopNotification = ({ message, contact, ticket }) => {
		const options = {
			body: `${message.body} - ${format(new Date(), "HH:mm")}`,
			icon: contact.profilePicUrl,
			tag: ticket.id,
		};
		let notification = new Notification(`Mensagem de ${contact.name}`, options);

		notification.onclick = function (event) {
			event.preventDefault(); //
			window.open(`/chat/${ticket.id}`, "_self");
		};

		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "visible") {
				notification.close();
			}
		});

		document.getElementById("sound").play();
	};

	const resetUnreadMessages = ({ ticketId }) => {
		setTickets(prevState => {
			const ticketIndex = prevState.findIndex(
				ticket => ticket.id === +ticketId
			);
			if (ticketIndex !== -1) {
				let aux = [...prevState];
				aux[ticketIndex].unreadMessages = 0;
				return aux;
			} else {
				return prevState;
			}
		});
	};

	const handleSelectTicket = (e, ticket) => {
		history.push(`/chat/${ticket.id}`);
	};

	const handleSearchContact = e => {
		if (e.target.value === "") {
			setSearchParam(e.target.value.toLowerCase());
			return;
		}
		setSearchParam(e.target.value.toLowerCase());
		setTab("search");
	};

	const handleChangeTab = (event, newValue) => {
		setTab(newValue);
	};

	const handleAcepptTicket = async ticketId => {
		try {
			await api.put(`/tickets/${ticketId}`, {
				status: "open",
				userId: userId,
			});
		} catch (err) {
			alert(err);
		}
		history.push(`/chat/${ticketId}`);
	};

	const countTickets = (status, userId) => {
		const ticketsFound = tickets.filter(
			t =>
				(t.status === status && t.userId === userId) ||
				(t.status === status && showAllTickets)
		).length;

		if (ticketsFound === 0) return "";
		return ticketsFound;
	};

	const CustomInfiniteScroll = ({ children, loadingKey }) => {
		return (
			<InfiniteScroll
				pageStart={0}
				loadMore={loadMore}
				hasMore={!(tickets.length === count)}
				useWindow={false}
				initialLoad={false}
				threshold={100}
				loader={<TicketsSkeleton key={loadingKey} />}
			>
				<List style={{ paddingTop: 0 }}>{children}</List>
			</InfiniteScroll>
		);
	};

	const CustomTicketList = ({ ...rest }) => {
		return (
			<TicketsList
				tickets={tickets}
				loading={loading}
				handleSelectTicket={handleSelectTicket}
				showAllTickets={showAllTickets}
				ticketId={ticketId}
				handleAcepptTicket={handleAcepptTicket}
				{...rest}
			/>
		);
	};

	console.log(tickets);

	return (
		<Paper elevation={0} variant="outlined" className={classes.contactsWrapper}>
			<NewTicketModal
				modalOpen={newTicketModalOpen}
				onClose={e => setNewTicketModalOpen(false)}
			/>
			<Paper elevation={0} square className={classes.tabsHeader}>
				<Tabs
					value={tab}
					onChange={handleChangeTab}
					variant="fullWidth"
					indicatorColor="primary"
					textColor="primary"
					aria-label="icon label tabs example"
				>
					<Tab
						value={"open"}
						icon={<MoveToInboxIcon />}
						label="Inbox"
						classes={{ root: classes.tab }}
					/>
					<Tab
						value={"closed"}
						icon={<CheckCircleOutlineIcon />}
						label="Resolvidos"
						classes={{ root: classes.tab }}
					/>
					<Tab
						value={"search"}
						icon={<SearchIcon />}
						label="Busca"
						classes={{ root: classes.tab }}
					/>
				</Tabs>
			</Paper>
			<Paper square elevation={0} className={classes.contactsSearchBox}>
				<div className={classes.serachInputWrapper}>
					<SearchIcon className={classes.searchIcon} />
					<InputBase
						className={classes.contactsSearchInput}
						placeholder="Pesquisar tickets e mensagens"
						type="search"
						onChange={handleSearchContact}
					/>
				</div>
			</Paper>
			<TabPanel value={tab} name={"open"} className={classes.contactsWrapper}>
				<Paper square elevation={0} className={classes.halfTicketsList}>
					<div className={classes.ticketsListHeader}>
						Atendendo
						<span className={classes.ticketsCount}>
							{countTickets("open", userId)}
						</span>
						<div className={classes.ticketsListActions}>
							<FormControlLabel
								label="Todos"
								labelPlacement="start"
								control={
									<Switch
										size="small"
										checked={showAllTickets}
										onChange={e => setShowAllTickets(prevState => !prevState)}
										name="showAllTickets"
										color="primary"
									/>
								}
							/>
							<IconButton
								aria-label="add ticket"
								onClick={e => setNewTicketModalOpen(true)}
								style={{ marginLeft: 20 }}
							>
								<AddIcon />
							</IconButton>
						</div>
					</div>
					<List style={{ paddingTop: 0 }}>
						{loading ? (
							<TicketsSkeleton />
						) : (
							<CustomTicketList
								noTicketsTitle="Pronto pra mais?"
								noTicketsMessage="Aceite um ticket da fila para começar."
								status="open"
								userId={userId}
							/>
						)}
					</List>
				</Paper>
				<Paper square elevation={0} className={classes.halfTicketsList}>
					<div className={classes.ticketsListHeader}>
						Aguardando
						<span className={classes.ticketsCount}>
							{countTickets("pending", null)}
						</span>
					</div>
					<List style={{ paddingTop: 0 }}>
						<CustomTicketList
							noTicketsTitle="Tudo resolvido"
							noTicketsMessage="Nenhum Ticket pendente"
							status="pending"
							userId={null}
						/>
					</List>
				</Paper>
			</TabPanel>
			<TabPanel value={tab} name="closed" className={classes.contactsWrapper}>
				<Paper square elevation={0} className={classes.fullHeightTicketsList}>
					<CustomInfiniteScroll loadingKey="loading-closed">
						<CustomTicketList status="closed" userId={null} />
					</CustomInfiniteScroll>
				</Paper>
			</TabPanel>
			<TabPanel value={tab} name="search" className={classes.contactsWrapper}>
				<Paper square elevation={0} className={classes.fullHeightTicketsList}>
					<CustomInfiniteScroll loadingKey="loading-all">
						<CustomTicketList
							noTicketsTitle="Nada encontrado"
							noTicketsMessage="Tente buscar por outro termo"
							status="all"
						/>
					</CustomInfiniteScroll>
				</Paper>
			</TabPanel>
			<audio id="sound" preload="auto">
				<source src={require("../../assets/sound.mp3")} type="audio/mpeg" />
				<source src={require("../../assets/sound.ogg")} type="audio/ogg" />
				<embed hidden={true} autostart="false" loop={false} src="./sound.mp3" />
			</audio>
		</Paper>
	);
};

export default Tickets;