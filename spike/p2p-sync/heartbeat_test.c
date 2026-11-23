/* S2 P2P Sync — heartbeat + clock-sync test (localhost)
 *
 * Multicast 239.255.0.2:6000. El maestro emite un heartbeat cada 20 ms
 * con su secuencia y timestamp (monotónico, segundos). Los esclavos
 * reciben y escriben su propio timestamp local, de modo que el script
 * de análisis pueda calcular el clock drift maestro ↔ esclavo.
 *
 * CSV de salida (columnas): role,node_id,seq,timestamp
 *
 * Uso maestro:   heartbeat_test --role master --duration 600 --output out.master.csv
 * Uso esclavo:   heartbeat_test --role slave --master-ip 127.0.0.1 --duration 600 \
 *                                   --output out.slave.csv --node-id slave1
 *
 * El script test_heartbeat.sh lanza 1 master + 2 slaves y combina los CSVs.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <time.h>

#define MCAST_ADDR "239.255.0.2"
#define MCAST_PORT 6000
#define INTERVAL_US 20000 /* 20 ms */

static volatile sig_atomic_t running = 1;
static void handle_signal(int sig) { (void)sig; running = 0; }

static double now_seconds(void)
{
	struct timespec ts;
	clock_gettime(CLOCK_MONOTONIC, &ts);
	return ts.tv_sec + ts.tv_nsec / 1e9;
}

int main(int argc, char *argv[])
{
	const char *role = "master";
	int duration = 600;
	const char *output = "heartbeat.csv";
	const char *master_ip = "127.0.0.1";
	const char *node_id = "master";

	for (int i = 1; i < argc; i++) {
		if (strcmp(argv[i], "--role") == 0 && i + 1 < argc)
			role = argv[++i];
		else if (strcmp(argv[i], "--duration") == 0 && i + 1 < argc)
			duration = atoi(argv[++i]);
		else if (strcmp(argv[i], "--output") == 0 && i + 1 < argc)
			output = argv[++i];
		else if (strcmp(argv[i], "--master-ip") == 0 && i + 1 < argc)
			master_ip = argv[++i];
		else if (strcmp(argv[i], "--node-id") == 0 && i + 1 < argc)
			node_id = argv[++i];
	}

	signal(SIGINT, handle_signal);
	signal(SIGTERM, handle_signal);

	FILE *csv = fopen(output, "w");
	if (!csv) { perror("fopen output"); return 1; }
	fprintf(csv, "role,node_id,seq,timestamp\n");
	fflush(csv);

	int sock = socket(AF_INET, SOCK_DGRAM, 0);
	if (sock < 0) { perror("socket"); fclose(csv); return 1; }

	int reuse = 1;
	setsockopt(sock, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));

	if (strcmp(role, "master") == 0) {
		/* Envío de heartbeats multicast cada 20 ms */
		int loop = 0;
		setsockopt(sock, IPPROTO_IP, IP_MULTICAST_LOOP, &loop, sizeof(loop));
		int ttl = 1;
		setsockopt(sock, IPPROTO_IP, IP_MULTICAST_TTL, &ttl, sizeof(ttl));

		struct sockaddr_in dst;
		memset(&dst, 0, sizeof(dst));
		dst.sin_family = AF_INET;
		dst.sin_addr.s_addr = inet_addr(MCAST_ADDR);
		dst.sin_port = htons(MCAST_PORT);

		int seq = 0;
		double end = now_seconds() + (double)duration;
		while (running && now_seconds() < end) {
			double ts = now_seconds();
			char msg[64];
			int len = snprintf(msg, sizeof(msg), "HB %d %.6f", seq, ts);
			sendto(sock, msg, (size_t)len, 0, (struct sockaddr *)&dst, sizeof(dst));
			fprintf(csv, "master,%s,%d,%.6f\n", node_id, seq, ts);
			fflush(csv);
			seq++;
			usleep(INTERVAL_US);
		}
	} else {
		/* Esclavo: unirse al grupo multicast y recibir heartbeats */
		struct sockaddr_in addr;
		memset(&addr, 0, sizeof(addr));
		addr.sin_family = AF_INET;
		addr.sin_addr.s_addr = htonl(INADDR_ANY);
		addr.sin_port = htons(MCAST_PORT);
		if (bind(sock, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
			perror("bind"); close(sock); fclose(csv); return 1;
		}

		struct ip_mreq mreq;
		memset(&mreq, 0, sizeof(mreq));
		mreq.imr_multiaddr.s_addr = inet_addr(MCAST_ADDR);
		mreq.imr_interface.s_addr = htonl(INADDR_ANY);
		setsockopt(sock, IPPROTO_IP, IP_ADD_MEMBERSHIP, &mreq, sizeof(mreq));

		char buf[128];
		struct sockaddr_in src;
		socklen_t slen = sizeof(src);
		struct timeval tv = {0, 200000};
		setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));

		double end = now_seconds() + (double)duration;
		while (running && now_seconds() < end) {
			ssize_t n = recvfrom(sock, buf, sizeof(buf) - 1, 0,
					     (struct sockaddr *)&src, &slen);
			if (n > 0) {
				buf[n] = '\0';
				int seq;
				double ts;
				if (sscanf(buf, "HB %d %lf", &seq, &ts) == 2) {
					double local = now_seconds();
					fprintf(csv, "slave,%s,%d,%.6f\n", node_id, seq, local);
					fflush(csv);
				}
			}
		}
	}

	close(sock);
	fclose(csv);
	return 0;
}
